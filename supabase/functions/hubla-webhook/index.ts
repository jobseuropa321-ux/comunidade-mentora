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

interface HublaBody {
  type: string;
  event: {
    userId: string;
    userName: string;
    userEmail: string;
    userPhone?: string;
    groupId?: string;
    groupName?: string;
    sellerId?: string;
    recurring?: string;
    paymentMethod?: string;
    transactionId: string;
    createdAt?: string;
    expiresAt?: string;
    paidAt?: string;
    isRenewing?: boolean;
    totalAmount?: number;
  };
  version?: string;
}

function mapStatusFromType(type: string): 'active' | 'canceled' | 'refunded' | null {
  const t = type.toLowerCase();
  if (t === 'newsale' || t === 'renewedsale') return 'active';
  if (t === 'canceledsale' || t === 'canceledsubscription' || t === 'subscription.deactivated') return 'canceled';
  if (t === 'refundedsale' || t === 'refundrequested') return 'refunded';
  return null;
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
    let body: HublaBody;
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
    }).then(() => {}).catch(() => {});

    // Valida token no header
    const token = req.headers.get('x-hubla-token');
    if (token !== webhookSecret) {
      return json({ error: 'token invalido' }, 401);
    }

    const evt = body.event;
    if (!evt) return json({ error: 'event ausente' }, 400);

    const email = evt.userEmail?.toLowerCase();
    if (!email) return json({ error: 'email ausente' }, 400);

    const newStatus = mapStatusFromType(body.type);
    if (!newStatus) {
      // Evento que não interessa (ex: abandono de carrinho) — ack e ignora
      return json({ ok: true, ignored: true, type: body.type });
    }

    const externalId = evt.transactionId;
    const expiresAt = evt.expiresAt || null;

    // Upsert na tabela subscriptions
    const { data: existing, error: lookupErr } = await admin
      .from('subscriptions')
      .select('id, user_id')
      .eq('provider', 'hubla')
      .eq('external_id', externalId)
      .maybeSingle();

    if (lookupErr) return json({ error: 'erro lookup: ' + lookupErr.message }, 500);

    const isFirstActivation = !existing && newStatus === 'active';

    // Se primeira ativacao: cria auth user (se nao existir)
    let userId: string | null = existing?.user_id ?? null;
    let generatedPassword: string | null = null;
    if (isFirstActivation) {
      generatedPassword = generatePassword(10);
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: generatedPassword,
        email_confirm: true,
        user_metadata: { full_name: evt.userName },
      });
      if (createErr) {
        // Email já tinha conta (recompra, compra dupla): não gera senha nova,
        // só linka o user existente à assinatura.
        generatedPassword = null;
        const { data: list } = await admin.auth.admin.listUsers();
        const found = list?.users?.find((u: { email?: string }) => u.email?.toLowerCase() === email);
        if (found) userId = found.id;
      } else {
        userId = created.user?.id ?? null;
      }
    }

    // Venda anual da Hubla chega como one_time_purchased. Este app só vende anual.
    const planType = evt.recurring === 'one_time_purchased' ? 'annual' : 'monthly';

    const upsertPayload = {
      user_id: userId,
      email,
      status: newStatus,
      provider: 'hubla',
      plan_type: planType,
      external_id: externalId,
      expires_at: expiresAt,
      raw_payload: body as unknown as Record<string, unknown>,
    };

    const { error: upsertErr } = await admin
      .from('subscriptions')
      .upsert(upsertPayload, { onConflict: 'provider,external_id' });

    if (upsertErr) return json({ error: 'erro upsert: ' + upsertErr.message }, 500);

    // Se primeira ativacao e criou user novo: manda email com login
    if (isFirstActivation && resendApiKey && generatedPassword) {
      try {
        await sendWelcomeEmail({
          resendApiKey,
          to: email,
          name: evt.userName,
          password: generatedPassword,
          loginUrl: 'https://app.comunidadedigital.com.br/auth',
        });
      } catch (e) {
        // Email falhou mas o acesso JÁ está liberado — não derruba o webhook.
        // Recuperação: usuário usa "Esqueci minha senha" na tela de login.
        console.error('email_error', e);
      }
    }

    return json({ ok: true, type: body.type, status: newStatus, email });
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
});
