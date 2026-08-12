import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ─────────────────────────────────────────────────────────────────────────
   hotmart-webhook — libera acesso das vendas em ESPANHOL feitas na Hotmart.

   Espelha o hubla-webhook (que é a referência viva deste projeto), com o
   e-mail em espanhol e o login apontando para /es/auth.

   ⚠️ DEPLOY: precisa de --no-verify-jwt. Sem a flag, a Hotmart recebe 401
   permanente e as vendas param de liberar acesso EM SILÊNCIO — só o painel
   da Hotmart reporta o erro. Está versionado em supabase/config.toml.

   ENV NECESSÁRIAS
     SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
     HOTMART_WEBHOOK_SECRET        → o hottok
     HOTMART_PRODUCT_IDS           → ids permitidos, separados por vírgula
     HOTMART_ANNUAL_PRODUCT_IDS    → subconjunto que é plano anual (opcional)
     RESEND_API_KEY

   O QUE FOI CORRIGIDO em relação ao webhook do kit (todos bugs medidos em
   produção no app original — ver DOCS/11 do kit):
     1. filtra por product.id; o original só valida o hottok, e 181 de 190
        eventos vieram de um produto que nem era o app
     2. valida o hottok ANTES de gravar log, e mascara o header; o original
        grava o segredo em texto plano, sem rate limit, para sempre
     3. plan_type vem de mapa explícito de product_id; o regex do original
        (/anual|annual|year|ano|año/) casa "ano" dentro de "Plano" e "Hispano"
     4. anual sem data de próxima cobrança cai em paidAt + 1 ano
     5. busca de usuário existente é paginada; o default do GoTrue é 50 por
        página, então em projeto grande o usuário não era encontrado e a
        subscription ficava com user_id NULL
     6. quando a conta já existe, manda e-mail de acesso liberado; o original
        não manda nada e a pessoa fica pagando sem saber a senha

   NÃO trata PURCHASE_DELAYED: no original ele vira 'expired' e corta o acesso
   na hora por um simples atraso de parcela, sem carência.
───────────────────────────────────────────────────────────────────────── */

const LOGIN_URL_ES = 'https://app.comunidadedigital.com.br/es/auth';
const MAIL_FROM = 'Comunidade Digital <contato@comunidadedigital.com.br>';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function generatePassword(length = 10): string {
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

/* Mapeia evento Hotmart -> status interno.
   PURCHASE_DELAYED fica DE FORA de propósito (ver cabeçalho). */
function mapStatusFromEvent(event: string): 'active' | 'canceled' | 'refunded' | 'expired' | null {
  const e = (event || '').toUpperCase();
  if (e === 'PURCHASE_APPROVED' || e === 'PURCHASE_COMPLETE') return 'active';
  if (e === 'SUBSCRIPTION_CANCELLATION' || e === 'PURCHASE_CANCELED') return 'canceled';
  if (e === 'PURCHASE_REFUNDED' || e === 'PURCHASE_CHARGEBACK' || e === 'PURCHASE_PROTEST') return 'refunded';
  if (e === 'PURCHASE_EXPIRED') return 'expired';
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

/* ── E-mails (espanhol) ─────────────────────────────────────────────── */

async function sendWelcomeEmailES(opts: {
  resendApiKey: string; to: string; name: string; password: string;
}) {
  const first = (opts.name || '').split(' ')[0] || '';
  const html = `
    <div style="font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="color:#BE0D3E;">¡Bienvenida a la Comunidad!</h2>
      <p>Hola ${first}, tu acceso ya está activo.</p>
      <p>Guarda estos datos, son tu acceso:</p>
      <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin:24px 0;">
        <p style="margin:4px 0;"><strong>Correo:</strong> ${opts.to}</p>
        <p style="margin:4px 0;"><strong>Contraseña:</strong> ${opts.password}</p>
      </div>
      <p>Si quieres cambiar la contraseña, toca «Olvidé mi contraseña» en la pantalla de inicio de sesión.</p>
      <p style="margin:32px 0;">
        <a href="${LOGIN_URL_ES}" target="_blank" style="display:inline-block;background:#BE0D3E;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">
          Entrar en la comunidad
        </a>
      </p>
      <p style="color:#999;font-size:12px;margin-top:40px;">Si no hiciste esta compra, ignora este correo.</p>
    </div>`;
  const text = `¡Bienvenida a la Comunidad!\n\nHola ${first}, tu acceso ya está activo.\n\nTu acceso:\nCorreo: ${opts.to}\nContraseña: ${opts.password}\n\nSi quieres cambiar la contraseña, toca «Olvidé mi contraseña» en la pantalla de inicio de sesión.\n\nEntrar: ${LOGIN_URL_ES}`;

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${opts.resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: MAIL_FROM, to: [opts.to], subject: 'Tu acceso a la Comunidad', html, text }),
  });
  if (!resp.ok) throw new Error(`Resend ${resp.status}: ${await resp.text()}`);
  return await resp.json();
}

/* Conta já existia (recompra, ou a pessoa já era aluna): não dá pra mandar a
   senha porque não conhecemos a atual. Avisa que o acesso está ativo e ensina
   a recuperar. Sem este e-mail, a pessoa paga e não sabe como entrar. */
async function sendAccessActiveEmailES(opts: {
  resendApiKey: string; to: string; name: string;
}) {
  const first = (opts.name || '').split(' ')[0] || '';
  const html = `
    <div style="font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="color:#BE0D3E;">Tu acceso ya está activo</h2>
      <p>Hola ${first}, ya puedes entrar con el correo <strong>${opts.to}</strong>.</p>
      <p>Usas la misma contraseña de siempre. ¿No la recuerdas? Toca «Olvidé mi contraseña» en la pantalla de inicio de sesión y te llega un enlace para crear una nueva.</p>
      <p style="margin:32px 0;">
        <a href="${LOGIN_URL_ES}" target="_blank" style="display:inline-block;background:#BE0D3E;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">
          Entrar en la comunidad
        </a>
      </p>
      <p style="color:#999;font-size:12px;margin-top:40px;">Si no hiciste esta compra, ignora este correo.</p>
    </div>`;
  const text = `Tu acceso ya está activo\n\nHola ${first}, ya puedes entrar con el correo ${opts.to}.\n\nUsas la misma contraseña de siempre. Si no la recuerdas, toca «Olvidé mi contraseña» en la pantalla de inicio de sesión.\n\nEntrar: ${LOGIN_URL_ES}`;

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${opts.resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: MAIL_FROM, to: [opts.to], subject: 'Tu acceso a la Comunidad está activo', html, text }),
  });
  if (!resp.ok) throw new Error(`Resend ${resp.status}: ${await resp.text()}`);
  return await resp.json();
}

/* ── Handler ────────────────────────────────────────────────────────── */

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const webhookSecret = Deno.env.get('HOTMART_WEBHOOK_SECRET');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!supabaseUrl || !serviceKey) return json({ error: 'config supabase ausente' }, 500);
    if (!webhookSecret) return json({ error: 'HOTMART_WEBHOOK_SECRET ausente' }, 500);

    const admin = createClient(supabaseUrl, serviceKey);

    const rawBody = await req.text();
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return json({ error: 'body invalido' }, 400);
    }

    // ── 1. HOTTOK ANTES DE QUALQUER GRAVAÇÃO ───────────────────────────
    // O webhook do kit grava o log ANTES de validar, com os headers crus: o
    // segredo fica em texto plano numa tabela, para sempre, e qualquer um que
    // descubra a URL consegue inflar a tabela. Aqui valida primeiro, e o
    // header do hottok nunca é gravado.
    const hottok = req.headers.get('x-hotmart-hottok')
      || (body as { hottok?: string }).hottok
      || '';
    if (hottok !== webhookSecret) {
      return json({ error: 'hottok invalido' }, 401);
    }

    const safeHeaders = Object.fromEntries(
      [...req.headers.entries()].filter(([k]) => {
        const key = k.toLowerCase();
        return key !== 'x-hotmart-hottok' && key !== 'authorization' && key !== 'apikey';
      }),
    );
    const safeBody = { ...body };
    delete (safeBody as { hottok?: unknown }).hottok;

    const logDebug = (extra?: Record<string, unknown>) =>
      admin.from('webhook_debug_log').insert({
        provider: 'hotmart',
        headers: { ...safeHeaders, note: 'hottok e authorization removidos' },
        body: extra ? { ...safeBody, _nota: extra } : safeBody,
        raw_body: '', // raw_body guardaria o hottok quando vem no corpo
      }).then(() => {}, () => {});

    // ── Payload (Hotmart v2: tudo dentro de `data`) ────────────────────
    const event = (body.event as string) || (body as { eventName?: string }).eventName || '';
    // deno-lint-ignore no-explicit-any
    const data = (body.data as Record<string, any>) || {};
    const buyer = data.buyer || data.subscriber || {};
    const purchase = data.purchase || {};
    const subscription = data.subscription || purchase.subscription || {};
    const product = data.product || {};

    // ── 2. FILTRO DE PRODUTO ───────────────────────────────────────────
    // Sem isto, qualquer venda feita com o mesmo hottok libera acesso ao app.
    // Lista VAZIA rejeita tudo de propósito: liberar geral por engano de
    // configuração é pior do que não liberar ninguém e aparecer no log.
    const allowedProducts = envList('HOTMART_PRODUCT_IDS');
    const productId = String(product?.id ?? product?.ucode ?? '');
    if (allowedProducts.length === 0) {
      await logDebug({ recusado: 'HOTMART_PRODUCT_IDS vazio', productId });
      return json({ error: 'HOTMART_PRODUCT_IDS nao configurado' }, 500);
    }
    if (!allowedProducts.includes(productId)) {
      await logDebug({ recusado: 'produto fora da lista', productId });
      return json({ ok: true, ignored: true, reason: 'produto_nao_permitido', productId });
    }

    await logDebug();

    const email = String(buyer.email || '').toLowerCase();
    if (!email) return json({ error: 'email ausente' }, 400);
    const name = buyer.name || buyer.full_name || '';

    const newStatus = mapStatusFromEvent(event);
    if (!newStatus) return json({ ok: true, ignored: true, event });

    // external_id: código da assinatura (estável na renovação) ou a transação.
    const externalId = String(
      subscription?.subscriber?.code
      || subscription?.code
      || purchase?.transaction
      || data.transaction
      || email,
    );

    // ── 3. PLAN_TYPE POR MAPA EXPLÍCITO ────────────────────────────────
    // O regex do original (/anual|annual|year|ano|año/) casa "ano" dentro de
    // "Plano" e "Hispano", então quase tudo virava 'annual' por engano.
    const annualProducts = envList('HOTMART_ANNUAL_PRODUCT_IDS');
    const planType: 'annual' | 'monthly' = annualProducts.includes(productId) ? 'annual' : 'monthly';

    // expires_at: próxima cobrança, quando a Hotmart manda (epoch em ms).
    const nextCharge = purchase?.date_next_charge ?? subscription?.date_next_charge;
    let expiresAt: string | null = null;
    if (nextCharge != null) {
      const n = typeof nextCharge === 'number' ? nextCharge : Number(nextCharge);
      if (!Number.isNaN(n)) expiresAt = new Date(n > 1e12 ? n : n * 1000).toISOString();
    }

    // ── 4. FALLBACK DO ANUAL ───────────────────────────────────────────
    // Hubla e Cakto têm isto; a Hotmart do kit não. Sem o fallback, o anual
    // fica com expires_at nulo e nunca expira.
    if (newStatus === 'active' && planType === 'annual' && !expiresAt) {
      const paidRaw = purchase?.approved_date ?? purchase?.order_date ?? data?.creation_date;
      const paidMs = typeof paidRaw === 'number'
        ? (paidRaw > 1e12 ? paidRaw : paidRaw * 1000)
        : Date.parse(String(paidRaw ?? '')) || Date.now();
      const base = new Date(paidMs);
      base.setUTCFullYear(base.getUTCFullYear() + 1);
      expiresAt = base.toISOString();
    }

    const { data: existing, error: lookupErr } = await admin
      .from('subscriptions')
      .select('id, user_id, expires_at')
      .eq('provider', 'hotmart')
      .eq('external_id', externalId)
      .maybeSingle();

    if (lookupErr) return json({ error: 'erro lookup: ' + lookupErr.message }, 500);

    // ── Conta ──────────────────────────────────────────────────────────
    let userId: string | null = (existing?.user_id as string | null) ?? null;
    let generatedPassword: string | null = null;
    let accountAlreadyExisted = false;

    if (newStatus === 'active' && !userId) {
      generatedPassword = generatePassword(10);
      let createErr: { message?: string; code?: string; status?: number } | null = null;

      // Mesma política do hubla-webhook: o 403 bad_jwt intermitente do Auth
      // dura segundos. Engolir o erro deixa o comprador sem conta e sem e-mail
      // (incidente 2026-07-23 neste projeto).
      const retryDelays = [3000, 10000];
      for (let attempt = 1; attempt <= 3; attempt++) {
        const res = await admin.auth.admin.createUser({
          email,
          password: generatedPassword,
          email_confirm: true,
          user_metadata: { full_name: name || null, locale: 'es' },
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
          // ── 5. BUSCA PAGINADA ──
          accountAlreadyExisted = true;
          generatedPassword = null;
          userId = await findUserIdByEmail(admin, email);
        } else {
          // Erro real: devolve 500 para a Hotmart retentar. Engolir aqui é o
          // que deixa comprador pagando e sem acesso.
          await logDebug({ erro: 'createUser falhou apos retry', detalhe: createErr.message ?? null });
          return json({ error: 'falha ao criar conta: ' + (createErr.message ?? 'auth error') }, 500);
        }
      }
    }

    const { error: upsertErr } = await admin
      .from('subscriptions')
      .upsert({
        user_id: userId,
        email,
        status: newStatus,
        provider: 'hotmart',
        plan_type: planType,
        external_id: externalId,
        expires_at: expiresAt ?? (existing?.expires_at as string | null) ?? null,
        raw_payload: safeBody as unknown as Record<string, unknown>,
      }, { onConflict: 'provider,external_id' });

    if (upsertErr) return json({ error: 'erro upsert: ' + upsertErr.message }, 500);

    // ── 6. E-MAIL ──────────────────────────────────────────────────────
    // Nunca derruba o webhook: a assinatura já está gravada e o acesso já
    // funciona; e-mail que falha é problema de entrega, não de liberação.
    if (newStatus === 'active' && resendApiKey) {
      try {
        if (generatedPassword) {
          await sendWelcomeEmailES({ resendApiKey, to: email, name, password: generatedPassword });
        } else if (accountAlreadyExisted) {
          await sendAccessActiveEmailES({ resendApiKey, to: email, name });
        }
      } catch (e) {
        await logDebug({ erro: 'resend falhou; acesso liberado mesmo assim', detalhe: String(e) });
      }
    }

    return json({ ok: true, event, status: newStatus, email, planType, productId });
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
});
