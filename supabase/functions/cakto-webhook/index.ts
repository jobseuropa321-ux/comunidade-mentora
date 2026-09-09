// ═══════════════════════════════════════════════════════════════════
// EDGE FUNCTION cakto-webhook — liberação de acesso das vendas na Cakto.
//
// Espelha o hubla-webhook (referência viva do projeto, mesma identidade
// e mesmo e-mail em PT). Fluxo: Cakto → webhook → upsert em subscriptions
// → cria conta com senha aleatória (1ª ativação) → e-mail via Resend.
//
// ⚠️ DEPLOY: precisa de verify_jwt = false (versionado em config.toml).
//    Sem isso a Cakto leva 401 permanente e as vendas param de liberar
//    acesso EM SILÊNCIO — só o painel da Cakto mostra o erro.
//
// SECRETS
//   CAKTO_WEBHOOK_SECRET        → segredo do webhook na Cakto
//   CAKTO_PRODUCT_IDS           → ids de produto/oferta permitidos (vírgula)
//   CAKTO_ANNUAL_PRODUCT_IDS    → subconjunto que é plano anual (opcional)
//   RESEND_API_KEY
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY vêm injetados.
//
// DIFERENÇAS DELIBERADAS EM RELAÇÃO AO HUBLA (todas por incidente medido):
//
//   • A Cakto manda o segredo DENTRO DO CORPO (campo `secret`), não só em
//     header. Por isso o log defensivo do hubla (que grava `raw_body` cru
//     antes de validar) não pode ser copiado: gravaria o segredo em texto
//     plano numa tabela, para sempre. Aqui valida ANTES de gravar, remove o
//     campo do corpo logado e nunca grava raw_body.
//
//   • Filtro por produto/oferta. Sem ele, qualquer venda da conta Cakto
//     libera acesso ao app (na Hotmart, 181 de 190 eventos eram de outro
//     produto). Lista vazia REJEITA tudo de propósito.
//
//   • expires_at do mensal fica NULL. A validade do plano não é a data que
//     o provedor manda no checkout: em 2026-07-23 a `expiresAt` da Hubla
//     (~1h, janela do checkout) foi gravada como validade e clientes
//     pagantes voltavam pro login sem mensagem de erro. Com NULL o
//     check_email_subscription trata como "sem expiração" e quem corta o
//     acesso é o evento de cancelamento/reembolso — não um relógio.
//     Anual (via CAKTO_ANNUAL_PRODUCT_IDS) usa paidAt + 1 ano.
// ═══════════════════════════════════════════════════════════════════
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LOGIN_URL = 'https://app.comunidadedigital.com.br/auth';
const MAIL_FROM = 'Comunidade Digital <contato@comunidadedigital.com.br>';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function generatePassword(length = 10): string {
  // Sem caracteres ambíguos (0/O, 1/l) — a senha é lida no e-mail e digitada.
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let pass = '';
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  for (const b of arr) pass += chars[b % chars.length];
  return pass;
}

const envList = (name: string): string[] =>
  (Deno.env.get(name) ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/* Comparação de segredo em tempo constante. O segredo da Cakto viaja no
   corpo, então este endpoint é a única barreira: `!==` vaza o tamanho do
   prefixo comum pelo tempo de resposta. */
function secretMatches(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* Mapeia evento da Cakto -> status interno.
   Os nomes vêm normalizados (minúsculo, sem separador) porque a Cakto varia
   entre `purchase_approved`, `purchase.approved` e `PurchaseApproved`
   dependendo da versão do webhook — o teste real confirma qual chega.

   Atrasos de cobrança ficam DE FORA de propósito: virar 'expired' corta o
   acesso na hora por uma parcela atrasada, sem carência. */
function mapStatusFromEvent(
  event: string,
): { status: 'active' | 'canceled' | 'refunded'; action: 'activate' | 'deactivate' | 'refund' } | null {
  const e = (event || '').toLowerCase().replace(/[^a-z]/g, '');

  if (['purchaseapproved', 'purchasecompleted', 'purchasecomplete', 'saleapproved',
       'subscriptionrenewed', 'subscriptionrenewal', 'subscriptioncreated'].includes(e)) {
    return { status: 'active', action: 'activate' };
  }
  if (['refund', 'refunded', 'purchaserefunded', 'chargeback', 'purchasechargeback'].includes(e)) {
    return { status: 'refunded', action: 'refund' };
  }
  if (['subscriptioncanceled', 'subscriptioncancelled', 'purchasecanceled',
       'purchasecancelled', 'subscriptionexpired'].includes(e)) {
    return { status: 'canceled', action: 'deactivate' };
  }
  // pix/boleto gerados, carrinho abandonado, compra recusada, atraso: ignorados.
  return null;
}

/* Procura usuário por e-mail percorrendo as páginas do GoTrue.
   O default é 50 por página: sem paginar, num projeto com muitos usuários o
   existente não é encontrado e a subscription nasce com user_id NULL. */
// deno-lint-ignore no-explicit-any
async function findUserIdByEmail(admin: any, email: string): Promise<string | null> {
  const target = email.toLowerCase();
  const perPage = 1000;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) return null;
    const users = data?.users ?? [];
    const found = users.find((u: { email?: string }) => u.email?.toLowerCase() === target);
    if (found) return found.id;
    if (users.length < perPage) return null; // acabou
  }
  return null;
}

/* ── E-mails ──────────────────────────────────────────────────────────
   HTML de e-mail: layout em tabela + estilo inline (é o que Gmail/Outlook/
   Apple Mail renderizam de forma confiável — nada de flex/grid/classe). */

function emailShell(inner: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Seu acesso à Comunidade Digital</title></head>
<body style="margin:0;padding:0;background-color:#FFF7E6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FFF7E6;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border-radius:20px;overflow:hidden;border:1px solid #F6D6DC;">

        <tr><td style="background-color:#BE0D3E;padding:28px 32px;" align="left">
          <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.2;color:#FFFFFF;font-weight:bold;letter-spacing:-0.3px;">Comunidade Digital</p>
          <p style="margin:6px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:11px;line-height:1.4;color:#FFD9E2;letter-spacing:2px;text-transform:uppercase;">Do atendimento ao digital</p>
        </td></tr>

        ${inner}

        <tr><td style="background-color:#FFF7E6;padding:22px 32px;border-top:1px solid #F6D6DC;">
          <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:#9B8586;">Se você não comprou a Comunidade Digital, pode ignorar este e-mail.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function ctaButton(loginUrl: string): string {
  return `<tr><td align="center" style="padding:28px 32px 8px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr><td align="center" style="background-color:#BE0D3E;border-radius:12px;">
              <a href="${loginUrl}" target="_blank" style="display:inline-block;padding:16px 38px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;color:#FFFFFF;text-decoration:none;letter-spacing:1.5px;text-transform:uppercase;">Entrar na comunidade</a>
            </td></tr>
          </table>
        </td></tr>`;
}

async function sendViaResend(apiKey: string, to: string, subject: string, html: string, text: string) {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    // Domínio comunidadedigital.com.br verificado no Resend.
    body: JSON.stringify({ from: MAIL_FROM, to: [to], subject, html, text }),
  });
  if (!resp.ok) throw new Error(`Resend ${resp.status}: ${await resp.text()}`);
  return await resp.json();
}

async function sendWelcomeEmail(opts: {
  resendApiKey: string; to: string; name: string; password: string;
}) {
  const firstName = (opts.name || '').trim().split(' ')[0] || 'tudo bem';
  const html = emailShell(`
        <tr><td style="padding:36px 32px 8px;">
          <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.25;color:#1E1B11;font-weight:normal;">Oi ${firstName}, seu acesso está liberado!</h1>
          <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#5B4041;">
            Sua compra foi confirmada e sua conta já está pronta. Guarda esses dados —
            é com eles que você entra na comunidade.
          </p>
        </td></tr>

        <tr><td style="padding:24px 32px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FFF7E6;border:1px solid #F6D6DC;border-radius:14px;">
            <tr><td style="padding:22px 24px;">
              <p style="margin:0 0 4px;font-family:Helvetica,Arial,sans-serif;font-size:10px;line-height:1.4;color:#5B4041;letter-spacing:1.8px;text-transform:uppercase;font-weight:bold;">Seu e-mail</p>
              <p style="margin:0 0 20px;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.4;color:#1E1B11;word-break:break-all;">${opts.to}</p>
              <p style="margin:0 0 4px;font-family:Helvetica,Arial,sans-serif;font-size:10px;line-height:1.4;color:#5B4041;letter-spacing:1.8px;text-transform:uppercase;font-weight:bold;">Sua senha</p>
              <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:24px;line-height:1.3;color:#BE0D3E;font-weight:bold;letter-spacing:2px;">${opts.password}</p>
            </td></tr>
          </table>
        </td></tr>

        ${ctaButton(LOGIN_URL)}

        <tr><td style="padding:22px 32px 36px;">
          <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#5B4041;">
            Quer trocar a senha? É só entrar e usar <strong style="color:#1E1B11;">“Esqueci minha senha”</strong> na tela de login. Salva este e-mail até fazer isso.
          </p>
        </td></tr>`);

  const text = `Oi ${firstName}, seu acesso está liberado!

Sua compra foi confirmada e sua conta já está pronta. Guarda esses dados:

E-mail: ${opts.to}
Senha: ${opts.password}

Entrar: ${LOGIN_URL}

Quer trocar a senha? É só usar "Esqueci minha senha" na tela de login.

Se você não comprou a Comunidade Digital, pode ignorar este e-mail.`;

  return await sendViaResend(opts.resendApiKey, opts.to, 'Seu acesso à Comunidade Digital', html, text);
}

/* Conta já existia (recompra, ou a pessoa já era aluna): não dá pra mandar a
   senha porque não conhecemos a atual. Sem este e-mail, a pessoa paga e não
   sabe como entrar. */
async function sendAccessActiveEmail(opts: {
  resendApiKey: string; to: string; name: string;
}) {
  const firstName = (opts.name || '').trim().split(' ')[0] || 'tudo bem';
  const html = emailShell(`
        <tr><td style="padding:36px 32px 8px;">
          <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.25;color:#1E1B11;font-weight:normal;">Oi ${firstName}, seu acesso está ativo!</h1>
          <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#5B4041;">
            Sua compra foi confirmada. Você já tinha uma conta com este e-mail
            (<strong style="color:#1E1B11;">${opts.to}</strong>), então é só entrar com a senha
            que você já usa. Se não lembrar, use <strong style="color:#1E1B11;">“Esqueci minha senha”</strong>
            na tela de login.
          </p>
        </td></tr>

        ${ctaButton(LOGIN_URL)}

        <tr><td style="padding:22px 32px 36px;"></td></tr>`);

  const text = `Oi ${firstName}, seu acesso está ativo!

Sua compra foi confirmada. Você já tinha uma conta com este e-mail (${opts.to}) — é só entrar com a senha que você já usa. Se não lembrar, use "Esqueci minha senha" na tela de login.

Entrar: ${LOGIN_URL}

Se você não comprou a Comunidade Digital, pode ignorar este e-mail.`;

  return await sendViaResend(opts.resendApiKey, opts.to, 'Seu acesso à Comunidade Digital', html, text);
}

/* ── Diagnóstico do 401 ───────────────────────────────────────────────
   Validar o segredo antes de logar (correto: ele vem no corpo) deixa um
   ponto cego: 401 sem nenhum registro do porquê. Isto grava só o FORMATO
   do que chegou — caminhos de chave, nomes de header, tamanho das strings
   e se o SHA-256 de cada uma bate com o segredo configurado. Nenhum valor
   é gravado, nem o certo nem o errado.

   Serve pra separar os dois motivos possíveis de 401:
     • campo diferente  → alguma string casa o hash, e o caminho dela diz onde
     • valor diferente  → nenhuma string casa, o segredo no Supabase está errado

   TEMPORÁRIO: remover assim que a Cakto estiver liberando acesso. */
async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function describePayloadShape(
  // deno-lint-ignore no-explicit-any
  value: any,
  expectedHash: string,
): Promise<Array<Record<string, unknown>>> {
  const out: Array<Record<string, unknown>> = [];
  const walk = async (node: unknown, path: string, depth: number) => {
    if (depth > 6 || out.length > 200) return;
    if (typeof node === 'string') {
      out.push({
        campo: path,
        tamanho: node.length,
        confere_com_secret: node.length > 0 && (await sha256Hex(node)) === expectedHash,
      });
      return;
    }
    if (Array.isArray(node)) {
      for (let i = 0; i < Math.min(node.length, 10); i++) await walk(node[i], `${path}[${i}]`, depth + 1);
      return;
    }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) await walk(v, path ? `${path}.${k}` : k, depth + 1);
    }
    // números/booleanos/null: irrelevantes pra achar o segredo
  };
  await walk(value, '', 0);
  return out;
}

/* ── Handler ────────────────────────────────────────────────────────── */

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const webhookSecret = Deno.env.get('CAKTO_WEBHOOK_SECRET');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!supabaseUrl || !serviceKey) return json({ error: 'config supabase ausente' }, 500);
    if (!webhookSecret) return json({ error: 'CAKTO_WEBHOOK_SECRET ausente' }, 500);

    const admin = createClient(supabaseUrl, serviceKey);

    const rawBody = await req.text();
    // deno-lint-ignore no-explicit-any
    let body: Record<string, any>;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return json({ error: 'body invalido' }, 400);
    }

    // ── 1. SEGREDO ANTES DE QUALQUER GRAVAÇÃO ──────────────────────────
    // A Cakto manda em `secret` no corpo; alguns painéis mandam em header.
    // Aceita os dois e valida antes de logar (ver cabeçalho).
    const sentSecret = String(
      body.secret
        ?? body.data?.secret
        ?? req.headers.get('x-cakto-signature')
        ?? req.headers.get('x-cakto-secret')
        ?? '',
    );
    if (!secretMatches(sentSecret, webhookSecret)) {
      // Ver describePayloadShape: grava só o formato, nunca os valores.
      try {
        const expectedHash = await sha256Hex(webhookSecret);
        const shape = await describePayloadShape(body, expectedHash);
        await admin.from('webhook_debug_log').insert({
          provider: 'cakto-secret-mismatch',
          headers: { nomes_de_header: [...req.headers.keys()] },
          body: {
            campos: shape,
            algum_campo_confere: shape.some((f) => f.confere_com_secret === true),
            tamanho_do_secret_configurado: webhookSecret.length,
            tamanho_do_secret_recebido: sentSecret.length,
            evento: String((body as { event?: unknown }).event ?? ''),
          },
          raw_body: '',
        });
      } catch { /* diagnóstico nunca derruba a resposta */ }
      return json({ error: 'secret invalido' }, 401);
    }

    const safeHeaders = Object.fromEntries(
      [...req.headers.entries()].filter(([k]) => {
        const key = k.toLowerCase();
        return key !== 'x-cakto-signature' && key !== 'x-cakto-secret'
          && key !== 'authorization' && key !== 'apikey';
      }),
    );
    const safeBody = { ...body };
    delete safeBody.secret;
    if (safeBody.data && typeof safeBody.data === 'object') {
      safeBody.data = { ...safeBody.data };
      delete safeBody.data.secret;
    }

    const logDebug = (extra?: Record<string, unknown>) =>
      admin.from('webhook_debug_log').insert({
        provider: 'cakto',
        headers: { ...safeHeaders, note: 'secret e authorization removidos' },
        body: extra ? { ...safeBody, _nota: extra } : safeBody,
        raw_body: '', // raw_body guardaria o secret, que vem no corpo
      }).then(() => {}, () => {});

    // ── Payload ────────────────────────────────────────────────────────
    const event = String(body.event ?? body.type ?? body.data?.event ?? '');
    const data = (body.data ?? body) as Record<string, any>;
    const customer = data.customer ?? data.buyer ?? data.client ?? {};
    const product = data.product ?? {};
    const offer = data.offer ?? data.offer_id ?? {};
    const subscription = data.subscription ?? {};

    // ── 2. FILTRO DE PRODUTO/OFERTA ────────────────────────────────────
    // Sem isto, qualquer venda da conta Cakto libera acesso ao app. Casa
    // tanto com id de produto quanto de oferta: a oferta nova é o que
    // identifica ESTA campanha.
    const allowed = envList('CAKTO_PRODUCT_IDS');
    const productId = String(product?.id ?? product?.short_id ?? data.product_id ?? '');
    const offerId = String(offer?.id ?? (typeof offer === 'string' ? offer : '') ?? data.offer_id ?? '');
    const ids = [productId, offerId].filter(Boolean);

    if (allowed.length === 0) {
      // 500 (e não 200) de propósito: a Cakto retenta, então assim que o
      // CAKTO_PRODUCT_IDS for preenchido o replay libera a venda sozinho.
      // Os ids vão na resposta pra aparecerem no painel da Cakto.
      await logDebug({ recusado: 'CAKTO_PRODUCT_IDS vazio', productId, offerId, event });
      return json({ error: 'CAKTO_PRODUCT_IDS nao configurado', productId, offerId }, 500);
    }
    if (!ids.some((id) => allowed.includes(id))) {
      await logDebug({ recusado: 'produto/oferta fora da lista', productId, offerId, event });
      return json({ ok: true, ignored: true, reason: 'produto_nao_permitido', productId, offerId });
    }

    await logDebug();

    const email = String(customer.email ?? data.email ?? '').toLowerCase().trim();
    if (!email) return json({ error: 'email ausente' }, 400);
    const name = String(customer.name ?? customer.full_name ?? data.name ?? '');

    const mapped = mapStatusFromEvent(event);
    if (!mapped) return json({ ok: true, ignored: true, event });
    const { status: newStatus, action } = mapped;

    // external_id: id da assinatura (estável na renovação) ou o da transação.
    const externalId = String(
      subscription?.id
        ?? data.subscription_id
        ?? data.id
        ?? data.transaction_id
        ?? data.order_id
        ?? email,
    );

    // ── 3. PLAN_TYPE POR MAPA EXPLÍCITO ────────────────────────────────
    // Nada de regex no nome do produto: /ano/ casa dentro de "Plano".
    const annual = envList('CAKTO_ANNUAL_PRODUCT_IDS');
    const planType: 'annual' | 'monthly' = ids.some((id) => annual.includes(id)) ? 'annual' : 'monthly';

    const { data: existing, error: lookupErr } = await admin
      .from('subscriptions')
      .select('id, user_id, status, expires_at')
      .eq('provider', 'cakto')
      .eq('external_id', externalId)
      .maybeSingle();

    if (lookupErr) return json({ error: 'erro lookup: ' + lookupErr.message }, 500);

    // Evento negativo sem compra correspondente não é uma assinatura: PIX
    // expirado/cartão recusado criaria uma linha 'canceled' nova que esconde
    // uma compra válida do mesmo e-mail.
    if (action !== 'activate' && !existing) {
      return json({ ok: true, ignored: true, reason: 'no_matching_subscription', event, email });
    }

    // Reembolso é terminal: replay atrasado da venda não pode reativar.
    if (existing?.status === 'refunded' && action === 'activate') {
      return json({ ok: true, ignored: true, reason: 'refunded_is_terminal', event, email });
    }

    // ── Conta ──────────────────────────────────────────────────────────
    // Ativação que precisa de conta: 1ª vez OU linha antiga que ficou sem
    // user_id (falha transitória do Auth — o replay da Cakto cura aqui).
    let userId: string | null = (existing?.user_id as string | null) ?? null;
    let generatedPassword: string | null = null;
    let accountAlreadyExisted = false;

    if (action === 'activate' && !userId) {
      generatedPassword = generatePassword(10);
      let createErr: { message?: string; code?: string; status?: number } | null = null;

      // Até 3 tentativas (3s/10s): o 403 bad_jwt intermitente do Auth dura
      // segundos. Engolir o erro deixa o comprador sem conta e sem e-mail
      // (incidente 2026-07-23).
      const retryDelays = [3000, 10000];
      for (let attempt = 1; attempt <= 3; attempt++) {
        const res = await admin.auth.admin.createUser({
          email,
          password: generatedPassword,
          email_confirm: true,
          user_metadata: { full_name: name || null },
        });
        if (!res.error) {
          userId = res.data.user?.id ?? null;
          createErr = null;
          break;
        }
        // deno-lint-ignore no-explicit-any
        const e = res.error as any;
        createErr = { message: e?.message, code: e?.code, status: e?.status };
        if (createErr.code === 'email_exists' || createErr.status === 422) break;
        const delay = retryDelays[attempt - 1];
        if (delay) await new Promise((r) => setTimeout(r, delay));
      }

      if (createErr) {
        if (createErr.code === 'email_exists' || createErr.status === 422) {
          accountAlreadyExisted = true;
          generatedPassword = null;
          userId = await findUserIdByEmail(admin, email);
        } else {
          // Erro real: 500 para a Cakto retentar. Engolir aqui é o que deixa
          // comprador pagando e sem acesso.
          await logDebug({ erro: 'createUser falhou apos retry', detalhe: createErr.message ?? null, email });
          return json({ error: 'falha ao criar conta: ' + (createErr.message ?? 'auth error') }, 500);
        }
      }
    }

    // ── expires_at ─────────────────────────────────────────────────────
    // Mensal: NULL (ver cabeçalho — data de checkout não é validade de plano).
    // Anual: paidAt + 1 ano.
    let expiresAt: string | null = (existing?.expires_at as string | null) ?? null;
    if (action === 'activate' && planType === 'annual') {
      const paidRaw = data.paidAt ?? data.paid_at ?? data.approvedAt ?? data.createdAt ?? data.created_at;
      const base = new Date(Date.parse(String(paidRaw ?? '')) || Date.now());
      base.setUTCFullYear(base.getUTCFullYear() + 1);
      expiresAt = base.toISOString();
    }

    const { error: upsertErr } = await admin
      .from('subscriptions')
      .upsert({
        user_id: userId,
        email,
        status: newStatus,
        provider: 'cakto',
        plan_type: planType,
        external_id: externalId,
        expires_at: expiresAt,
        raw_payload: safeBody as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'provider,external_id' });

    if (upsertErr) return json({ error: 'erro upsert: ' + upsertErr.message }, 500);

    // Desativação/reembolso revoga a sessão apenas se não houver outra compra
    // válida para o e-mail (a pessoa pode ter comprado também na Hubla).
    if ((action === 'deactivate' || action === 'refund') && userId) {
      const { data: accessStatus, error: accessErr } = await admin.rpc(
        'check_email_subscription',
        { check_email: email },
      );
      if (accessErr) return json({ error: 'falha ao revalidar acesso: ' + accessErr.message }, 500);

      if (accessStatus !== 'active') {
        const { error: revokeErr } = await admin.rpc('revoke_user_sessions_for_access', { _user_id: userId });
        if (revokeErr) {
          await logDebug({ erro: 'assinatura bloqueada, mas revogacao de sessao falhou', detalhe: revokeErr.message, email });
          // A assinatura já foi bloqueada. O 500 pede retry para concluir a
          // revogação; o processamento é idempotente.
          return json({ error: 'falha ao revogar sessoes' }, 500);
        }
      }
    }

    // ── E-mail ─────────────────────────────────────────────────────────
    // Nunca derruba o webhook: a assinatura já está gravada e o acesso já
    // funciona; e-mail que falha é problema de entrega, não de liberação.
    if (action === 'activate' && resendApiKey && (generatedPassword || accountAlreadyExisted)) {
      try {
        if (generatedPassword) {
          await sendWelcomeEmail({ resendApiKey, to: email, name, password: generatedPassword });
        } else {
          await sendAccessActiveEmail({ resendApiKey, to: email, name });
        }
      } catch (e) {
        console.error('email_error', e);
        await logDebug({ erro: 'Resend falhou; acesso liberado mesmo assim', detalhe: String(e), email });
      }
    }

    return json({ ok: true, event, action, status: newStatus, email, planType, productId, offerId });
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
});
