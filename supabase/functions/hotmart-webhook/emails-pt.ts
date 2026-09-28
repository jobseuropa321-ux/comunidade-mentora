/* ─────────────────────────────────────────────────────────────────────────
   E-mails em PORTUGUÊS do hotmart-webhook (produtos do Brasil).

   Cópia fiel dos e-mails do hubla-webhook (mesma identidade, mesmos textos),
   pra quem compra pela Hotmart receber exatamente o que recebe quem compra
   pela Hubla. Fica copiado em vez de compartilhado de propósito: mexer num
   arquivo comum obrigaria redeployar o hubla-webhook, que é o que vende hoje.
   Se mudar o texto lá, mude aqui também.
───────────────────────────────────────────────────────────────────────── */

/* ── Email de boas-vindas — identidade Comunidade Digital ──
   HTML de email: layout em tabela + estilo inline (é o que Gmail/Outlook/
   Apple Mail renderizam de forma confiável — nada de flex/grid/classe). */
export async function sendWelcomeEmailPT(opts: {
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
export async function sendAccessActiveEmailPT(opts: {
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
