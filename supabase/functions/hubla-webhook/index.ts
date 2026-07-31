// ═══════════════════════════════════════════════════════════════════
// EDGE FUNCTION hubla-webhook — liberação de acesso por compra.
// Replicado do kit `modulos/acesso/kit-acesso-hubla-resend/` (produção
// do Viral1MIN), com o email refeito na identidade da Comunidade Digital.
//
// Fluxo: Hubla → webhook → upsert em subscriptions → cria conta com senha
// aleatória (1ª ativação) → email de boas-vindas via Resend.
//
// Secrets usados:
//   HUBLA_WEBHOOK_SECRET  → token que a Hubla manda no header x-hubla-token
//   RESEND_API_KEY        → API key do Resend
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são injetados automático.
//
// ⚠️ DEPLOY OBRIGATÓRIO COM verify_jwt = false (a Hubla não manda JWT).
//    A function se protege sozinha validando o x-hubla-token.
// ═══════════════════════════════════════════════════════════════════
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  hasAuthenticatedLegacyTwin,
  parseHublaPayload,
} from "./hubla-payload.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function generatePassword(length = 10): string {
  // Sem caracteres ambíguos (0/O, 1/l) — a senha é lida no email e digitada.
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let pass = '';
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  for (const b of arr) pass += chars[b % chars.length];
  return pass;
}

async function hasRecentLegacyTwin(
  admin: ReturnType<typeof createClient<any>>,
  externalId: string,
  webhookToken: string,
): Promise<boolean> {
  // Os eventos v1/v2 chegam em paralelo. Esta espera curta dá tempo para o
  // request v1 concluir o log antes de verificarmos a duplicidade.
  await new Promise((resolve) => setTimeout(resolve, 400));

  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from('webhook_debug_log')
    .select('headers, body')
    .eq('provider', 'hubla')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error || !data) return false;
  return hasAuthenticatedLegacyTwin(data, externalId, webhookToken);
}

/* ── Email de boas-vindas — identidade Comunidade Digital ──
   HTML de email: layout em tabela + estilo inline (é o que Gmail/Outlook/
   Apple Mail renderizam de forma confiável — nada de flex/grid/classe). */
async function sendWelcomeEmail(opts: {
  resendApiKey: string;
  to: string;
  name: string;
  password: string;
  loginUrl: string;
}) {
  const firstName = (opts.name || '').trim().split(' ')[0] || 'tudo bem';

  const html = `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Seu acesso à Comunidade Digital</title></head>
<body style="margin:0;padding:0;background-color:#FFF7E6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FFF7E6;padding:24px 12px;">
    <tr><td align="center">

      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border-radius:20px;overflow:hidden;border:1px solid #F6D6DC;">

        <!-- Faixa da marca -->
        <tr><td style="background-color:#BE0D3E;padding:28px 32px;" align="left">
          <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.2;color:#FFFFFF;font-weight:bold;letter-spacing:-0.3px;">
            Comunidade Digital
          </p>
          <p style="margin:6px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:11px;line-height:1.4;color:#FFD9E2;letter-spacing:2px;text-transform:uppercase;">
            Do atendimento ao digital
          </p>
        </td></tr>

        <!-- Boas-vindas -->
        <tr><td style="padding:36px 32px 8px;">
          <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.25;color:#1E1B11;font-weight:normal;">
            Oi ${firstName}, seu acesso está liberado!
          </h1>
          <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#5B4041;">
            Sua compra foi confirmada e sua conta já está pronta. Guarda esses dados —
            é com eles que você entra na comunidade.
          </p>
        </td></tr>

        <!-- Credenciais -->
        <tr><td style="padding:24px 32px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FFF7E6;border:1px solid #F6D6DC;border-radius:14px;">
            <tr><td style="padding:22px 24px;">
              <p style="margin:0 0 4px;font-family:Helvetica,Arial,sans-serif;font-size:10px;line-height:1.4;color:#5B4041;letter-spacing:1.8px;text-transform:uppercase;font-weight:bold;">
                Seu e-mail
              </p>
              <p style="margin:0 0 20px;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.4;color:#1E1B11;word-break:break-all;">
                ${opts.to}
              </p>
              <p style="margin:0 0 4px;font-family:Helvetica,Arial,sans-serif;font-size:10px;line-height:1.4;color:#5B4041;letter-spacing:1.8px;text-transform:uppercase;font-weight:bold;">
                Sua senha
              </p>
              <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:24px;line-height:1.3;color:#BE0D3E;font-weight:bold;letter-spacing:2px;">
                ${opts.password}
              </p>
            </td></tr>
          </table>
        </td></tr>

        <!-- Botão -->
        <tr><td align="center" style="padding:28px 32px 8px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr><td align="center" style="background-color:#BE0D3E;border-radius:12px;">
              <a href="${opts.loginUrl}" target="_blank"
                 style="display:inline-block;padding:16px 38px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;color:#FFFFFF;text-decoration:none;letter-spacing:1.5px;text-transform:uppercase;">
                Entrar na comunidade
              </a>
            </td></tr>
          </table>
        </td></tr>

        <!-- Dica -->
        <tr><td style="padding:22px 32px 36px;">
          <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#5B4041;">
            Quer trocar a senha? É só entrar e usar
            <strong style="color:#1E1B11;">“Esqueci minha senha”</strong> na tela de login.
            Salva este e-mail até fazer isso.
          </p>
        </td></tr>

        <!-- Rodapé -->
        <tr><td style="background-color:#FFF7E6;padding:22px 32px;border-top:1px solid #F6D6DC;">
          <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:#9B8586;">
            Se você não comprou a Comunidade Digital, pode ignorar este e-mail.
          </p>
        </td></tr>

      </table>

    </td></tr>
  </table>
</body>
</html>`;

  const text = `Oi ${firstName}, seu acesso está liberado!

Sua compra foi confirmada e sua conta já está pronta. Guarda esses dados:

E-mail: ${opts.to}
Senha: ${opts.password}

Entrar: ${opts.loginUrl}

Quer trocar a senha? É só usar "Esqueci minha senha" na tela de login.

Se você não comprou a Comunidade Digital, pode ignorar este e-mail.`;

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${opts.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      // Domínio comunidadedigital.com.br verificado no Resend.
      from: 'Comunidade Digital <contato@comunidadedigital.com.br>',
      to: [opts.to],
      subject: 'Seu acesso à Comunidade Digital',
      html,
      text,
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Resend ${resp.status}: ${errText}`);
  }
  return await resp.json();
}

/* ── Email "acesso ativo" — pra quem JÁ tinha conta (recompra/renovação).
   Não tem senha nova pra mandar: orienta usar a senha existente ou o
   "Esqueci minha senha". Sem isso, quem recompra não recebe email nenhum. */
async function sendAccessActiveEmail(opts: {
  resendApiKey: string;
  to: string;
  name: string;
  loginUrl: string;
}) {
  const firstName = (opts.name || '').trim().split(' ')[0] || 'tudo bem';
  const html = `<!doctype html>
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
        <tr><td style="padding:36px 32px 8px;">
          <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.25;color:#1E1B11;font-weight:normal;">Oi ${firstName}, seu acesso está ativo!</h1>
          <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#5B4041;">
            Sua compra foi confirmada. Você já tinha uma conta com este e-mail
            (<strong style="color:#1E1B11;">${opts.to}</strong>), então é só entrar com a senha
            que você já usa. Se não lembrar, use <strong style="color:#1E1B11;">“Esqueci minha senha”</strong>
            na tela de login.
          </p>
        </td></tr>
        <tr><td align="center" style="padding:28px 32px 8px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr><td align="center" style="background-color:#BE0D3E;border-radius:12px;">
              <a href="${opts.loginUrl}" target="_blank" style="display:inline-block;padding:16px 38px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;color:#FFFFFF;text-decoration:none;letter-spacing:1.5px;text-transform:uppercase;">Entrar na comunidade</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="background-color:#FFF7E6;padding:22px 32px;border-top:1px solid #F6D6DC;">
          <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:#9B8586;">Se você não comprou a Comunidade Digital, pode ignorar este e-mail.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  const text = `Oi ${firstName}, seu acesso está ativo!

Sua compra foi confirmada. Você já tinha uma conta com este e-mail (${opts.to}) — é só entrar com a senha que você já usa. Se não lembrar, use "Esqueci minha senha" na tela de login.

Entrar: ${opts.loginUrl}

Se você não comprou a Comunidade Digital, pode ignorar este e-mail.`;
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${opts.resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Comunidade Digital <contato@comunidadedigital.com.br>',
      to: [opts.to],
      subject: 'Seu acesso à Comunidade Digital',
      html,
      text,
    }),
  });
  if (!resp.ok) throw new Error(`Resend ${resp.status}: ${await resp.text()}`);
  return await resp.json();
}

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const webhookSecret = Deno.env.get('HUBLA_WEBHOOK_SECRET');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!supabaseUrl || !serviceKey) return json({ error: 'config supabase ausente' }, 500);
    if (!webhookSecret) return json({ error: 'HUBLA_WEBHOOK_SECRET ausente' }, 500);

    const admin = createClient(supabaseUrl, serviceKey);

    const rawBody = await req.text();
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return json({ error: 'body invalido' }, 400);
    }

    // Log defensivo: salva TUDO que chega, antes de validar o token.
    // É o que permite debugar payload esquisito ou token errado depois.
    await admin.from('webhook_debug_log').insert({
      provider: 'hubla',
      headers: Object.fromEntries(req.headers.entries()),
      body,
      raw_body: rawBody,
    }).then(() => {}, () => {});

    // Valida token no header
    const token = req.headers.get('x-hubla-token');
    if (token !== webhookSecret) {
      return json({ error: 'token invalido' }, 401);
    }

    const parsed = parseHublaPayload(body);
    if (parsed.kind === 'ignored') {
      return json({ ok: true, ignored: true, type: parsed.eventType });
    }
    if (parsed.kind === 'error') {
      return json({ error: parsed.message }, 400);
    }

    const evt = parsed.event;
    const {
      action,
      email,
      eventType,
      externalId,
      format,
      planType,
      status: newStatus,
    } = evt;

    // Durante a migração da Hubla, a mesma venda normalmente chega como
    // NewSale (v1) e invoice.payment_succeeded (v2). Processar os dois em
    // paralelo criaria uma corrida no Auth e poderia mandar dois emails.
    // Se há um v1 autenticado, ele processa a venda e o auto-reparo o cobre.
    // Quando só o v2 chega, ele segue normalmente (caso real da Hosana).
    if (
      format === 'v2'
      && action === 'activate'
      && await hasRecentLegacyTwin(admin, externalId, token)
    ) {
      return json({
        ok: true,
        duplicate: true,
        reason: 'legacy_twin',
        type: eventType,
        status: newStatus,
        email,
      });
    }

    // Upsert na tabela subscriptions
    const { data: existing, error: lookupErr } = await admin
      .from('subscriptions')
      .select('id, user_id, status, expires_at')
      .eq('provider', 'hubla')
      .eq('external_id', externalId)
      .maybeSingle();

    if (lookupErr) return json({ error: 'erro lookup: ' + lookupErr.message }, 500);

    // Evento negativo sem uma compra correspondente não é uma assinatura.
    // A Hubla envia CanceledSale para PIX expirado/cartão recusado; antes isso
    // criava uma linha canceled nova e escondia uma compra válida do mesmo email.
    if (action !== 'activate' && !existing) {
      return json({
        ok: true,
        ignored: true,
        reason: 'no_matching_subscription',
        type: eventType,
        status: newStatus,
        email,
      });
    }

    // Reembolso é terminal para uma transação. Um replay atrasado da venda
    // não pode reativar a mesma fatura depois que o reembolso já chegou.
    if (existing?.status === 'refunded' && action === 'activate') {
      return json({
        ok: true,
        ignored: true,
        reason: 'refunded_is_terminal',
        type: eventType,
        status: existing.status,
        email,
      });
    }

    // Ativação que precisa de conta: 1ª vez OU linha antiga que ficou sem
    // user_id (ex.: falha transitória do Auth — replay da Hubla cura aqui).
    let userId: string | null = existing?.user_id ?? null;
    let generatedPassword: string | null = null;
    let accountAlreadyExisted = false;

    if (action === 'activate' && !userId) {
      generatedPassword = generatePassword(10);
      let createErr: { message?: string; code?: string; status?: number } | null = null;

      // Até 3 tentativas (esperas 3s/10s): o 403 bad_jwt intermitente do Auth
      // (3+ casos em 23-24/07) costuma durar segundos — janelas longas (minutos)
      // ficam pro auto-reparo heal_hubla_webhook (pg_cron a cada 5 min).
      const retryDelays = [3000, 10000];
      for (let attempt = 1; attempt <= 3; attempt++) {
        const res = await admin.auth.admin.createUser({
          email,
          password: generatedPassword,
          email_confirm: true,
          user_metadata: { full_name: evt.userName || null },
        });
        if (!res.error) {
          userId = res.data.user?.id ?? null;
          createErr = null;
          break;
        }
        // deno-lint-ignore no-explicit-any
        const e = res.error as any;
        createErr = { message: e?.message, code: e?.code, status: e?.status };
        const isEmailExists = createErr.code === 'email_exists' || createErr.status === 422;
        if (isEmailExists) break; // não é transitório — trata abaixo
        const delay = retryDelays[attempt - 1];
        if (delay) await new Promise((r) => setTimeout(r, delay));
      }

      if (createErr) {
        const isEmailExists = createErr.code === 'email_exists' || createErr.status === 422;
        if (isEmailExists) {
          // Recompra/conta pré-existente: linka o user e avisa por email (sem senha).
          accountAlreadyExisted = true;
          generatedPassword = null;
          const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const found = list?.users?.find((u: { email?: string }) => u.email?.toLowerCase() === email);
          if (found) userId = found.id;
        } else {
          // Erro REAL de criação de conta: loga e devolve 500 — a Hubla retenta
          // e o replay cura (antes isso era engolido e o cliente ficava sem acesso).
          await admin.from('webhook_debug_log').insert({
            provider: 'hubla-auth-error',
            headers: { note: 'createUser falhou apos retry' },
            body: { error: createErr.message ?? 'auth error', code: createErr.code ?? null, status: createErr.status ?? null, email, tx: externalId },
            raw_body: '',
          }).then(() => {}, () => {});
          return json({ error: 'falha ao criar conta: ' + (createErr.message ?? 'auth error') }, 500);
        }
      }
    }

    // expiresAt/dueDate NÃO é a validade do plano: na venda anual à vista a Hubla
    // manda ~1h (janela do checkout) ou ~5 dias, e o gate de login derruba o
    // cliente quando isso vence (incidente 2026-07-23, 5 clientes travados).
    // Plano anual: validade = paidAt + 1 ano, calculada aqui.
    let expiresAt: string | null = existing?.expires_at ?? evt.expiresAt ?? null;
    if (action === 'activate' && planType === 'annual') {
      const base = new Date(Date.parse(evt.paidAt ?? evt.createdAt ?? '') || Date.now());
      base.setUTCFullYear(base.getUTCFullYear() + 1);
      expiresAt = base.toISOString();
    }

    const upsertPayload = {
      user_id: userId,
      email,
      status: newStatus,
      provider: 'hubla',
      plan_type: planType,
      external_id: externalId,
      expires_at: expiresAt,
      raw_payload: body as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertErr } = await admin
      .from('subscriptions')
      .upsert(upsertPayload, { onConflict: 'provider,external_id' });

    if (upsertErr) return json({ error: 'erro upsert: ' + upsertErr.message }, 500);

    // Cancelar só a renovação mantém o período já pago. Desativação/reembolso
    // revoga a sessão apenas se não houver outra compra válida para o email.
    if ((action === 'deactivate' || action === 'refund') && userId) {
      const { data: accessStatus, error: accessErr } = await admin.rpc(
        'check_email_subscription',
        { check_email: email },
      );

      if (accessErr) {
        return json({ error: 'falha ao revalidar acesso: ' + accessErr.message }, 500);
      }

      const { error: revokeErr } = accessStatus === 'active'
        ? { error: null }
        : await admin.rpc('revoke_user_sessions_for_access', { _user_id: userId });

      if (revokeErr) {
        await admin.from('webhook_debug_log').insert({
          provider: 'hubla-session-revoke-error',
          headers: { note: 'assinatura bloqueada, mas revogação de sessão falhou' },
          body: { error: revokeErr.message, email, tx: externalId },
          raw_body: '',
        }).then(() => {}, () => {});
        // A assinatura já foi bloqueada. O 500 pede retry para concluir também
        // a revogação das sessões; o processamento é idempotente.
        return json({ error: 'falha ao revogar sessoes' }, 500);
      }
    }

    // Email pós-ativação: conta nova → credenciais; conta que já existia →
    // aviso "acesso ativo" (antes a recompra ficava SEM email nenhum).
    const loginUrl = 'https://app.comunidadedigital.com.br/auth';
    if (action === 'activate' && resendApiKey && (generatedPassword || accountAlreadyExisted)) {
      try {
        if (generatedPassword) {
          await sendWelcomeEmail({ resendApiKey, to: email, name: evt.userName, password: generatedPassword, loginUrl });
        } else {
          await sendAccessActiveEmail({ resendApiKey, to: email, name: evt.userName, loginUrl });
        }
      } catch (e) {
        // Email falhou mas o acesso JÁ está liberado — não derruba o webhook.
        // Loga no banco (consultável via SQL) além do console.
        console.error('email_error', e);
        await admin.from('webhook_debug_log').insert({
          provider: 'hubla-email-error',
          headers: { note: 'Resend falhou; acesso liberado mesmo assim' },
          body: { error: String(e), email, tx: externalId },
          raw_body: '',
        }).then(() => {}, () => {});
      }
    }

    return json({ ok: true, type: eventType, format, action, status: newStatus, email });
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
});
