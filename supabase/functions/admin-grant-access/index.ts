// ═══════════════════════════════════════════════════════════════════
// EDGE FUNCTION admin-grant-access — liberação MANUAL de acesso.
//
// Usada pela aba "Acessos" do painel admin: a expert digita o e-mail,
// a function cria a conta (ou reseta a senha de quem já existe) e
// devolve a senha em texto UMA única vez, pra ela copiar e mandar.
//
// ── SEGURANÇA (as 4 camadas) ──────────────────────────────────────
// 1. Gateway: deploy com verify_jwt = true → sem JWT válido nem entra.
// 2. Sessão: getUser() com a anon key + o Authorization do chamador.
//    Token forjado/expirado morre aqui.
// 3. Papel: o service_role consulta public.user_roles e exige role
//    'expert'. Quem é aluna leva 403 mesmo com sessão válida — e a
//    checagem NÃO vem do frontend (é reconsultada no banco).
// 4. Escrita: só o service_role escreve em subscriptions/user_roles/
//    access_grants (RLS não tem policy de insert pra authenticated),
//    então a única porta pra liberar acesso é esta function.
// + Teto de 30 liberações/hora por admin (token roubado não vira fábrica
//   de contas) e trilha de auditoria em access_grants.
//
// A SENHA em texto só existe na resposta HTTP: não é gravada em banco
// nem em console.log.
//
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// (injetados automático) + ALLOWED_ORIGIN (opcional, mesmo do chat-viral).
// ═══════════════════════════════════════════════════════════════════
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || '*';
const MAX_GRANTS_PER_HOUR = 30;

// localhost sempre liberado (dev); qualquer outra origem segue ALLOWED_ORIGIN
function buildCorsHeaders(origin: string | null) {
  const isLocalhost = !!origin &&
    (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'));
  return {
    'Access-Control-Allow-Origin': isLocalhost ? origin : ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

/** Senha sem caracteres ambíguos (0/O, 1/l) — ela é lida e digitada à mão. */
function generatePassword(length = 10): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let pass = '';
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  for (const b of arr) pass += chars[b % chars.length];
  return pass;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

type AccessType = 'aluna' | 'expert';
type Duration = '1m' | '6m' | '12m' | 'lifetime';

/** Validade do acesso. 'lifetime' → null (check_email_subscription
 *  só marca 'expired' quando expires_at existe e já passou). */
function computeExpiresAt(duration: Duration): string | null {
  if (duration === 'lifetime') return null;
  const d = new Date();
  if (duration === '12m') d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + (duration === '6m' ? 6 : 1));
  return d.toISOString();
}

serve(async (req) => {
  const cors = buildCorsHeaders(req.headers.get('Origin'));
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'metodo_invalido' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: 'config_ausente' }, 500);

    // ── Camada 2: sessão do chamador ──────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'nao_autenticado' }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user: caller }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !caller) return json({ error: 'sessao_invalida' }, 401);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ── Camada 3: o chamador é expert? (fonte = banco, não o frontend) ──
    const { data: callerRole, error: roleErr } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .eq('role', 'expert')
      .maybeSingle();
    if (roleErr) return json({ error: 'erro_permissao' }, 500);
    if (!callerRole) return json({ error: 'sem_permissao' }, 403);

    // ── Entrada ───────────────────────────────────────────────────
    let body: { email?: string; fullName?: string; accessType?: string; duration?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: 'body_invalido' }, 400);
    }

    const email = (body.email ?? '').trim().toLowerCase();
    if (!email || email.length > 254 || !EMAIL_RE.test(email)) return json({ error: 'email_invalido' }, 400);

    const fullName = (body.fullName ?? '').trim().slice(0, 120) || null;
    const accessType: AccessType = body.accessType === 'expert' ? 'expert' : 'aluna';
    const duration: Duration = (['1m', '6m', '12m', 'lifetime'] as const).includes(body.duration as Duration)
      ? (body.duration as Duration)
      : '12m';

    // ── Teto anti-abuso: 30 liberações/hora por admin ─────────────
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count: recent, error: countErr } = await admin
      .from('access_grants')
      .select('id', { count: 'exact', head: true })
      .eq('granted_by', caller.id)
      .gte('created_at', since);
    if (countErr) return json({ error: 'erro_limite' }, 500);
    if ((recent ?? 0) >= MAX_GRANTS_PER_HOUR) {
      return json({ error: 'limite_atingido', limit: MAX_GRANTS_PER_HOUR, used: recent ?? 0 }, 429);
    }

    // ── Conta: cria ou reseta a senha ─────────────────────────────
    const password = generatePassword(10);

    const { data: existingId, error: lookupErr } = await admin
      .rpc('admin_user_id_by_email', { _email: email });
    if (lookupErr) return json({ error: 'erro_lookup' }, 500);

    let userId: string | null = (existingId as string | null) ?? null;
    let action: 'created' | 'password_reset' = userId ? 'password_reset' : 'created';

    // 2 tentativas: o 403 bad_jwt do Auth é intermitente (incidente 23/07)
    // e costuma passar em segundos.
    let lastErr: string | null = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      if (userId) {
        const res = await admin.auth.admin.updateUserById(userId, {
          password,
          email_confirm: true,
        });
        if (!res.error) { lastErr = null; break; }
        lastErr = res.error.message;
      } else {
        const res = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: fullName ? { full_name: fullName } : {},
        });
        if (!res.error) {
          userId = res.data.user?.id ?? null;
          action = 'created';
          lastErr = null;
          break;
        }
        // deno-lint-ignore no-explicit-any
        const e = res.error as any;
        lastErr = e?.message ?? 'auth error';
        // Corrida: conta criada entre o lookup e o create → vira reset.
        if (e?.code === 'email_exists' || e?.status === 422) {
          const { data: raced } = await admin.rpc('admin_user_id_by_email', { _email: email });
          userId = (raced as string | null) ?? null;
          action = 'password_reset';
          if (!userId) return json({ error: 'conta_existe_sem_id' }, 500);
          continue; // próxima volta faz o update da senha
        }
      }
      if (attempt === 1) await new Promise((r) => setTimeout(r, 2000));
    }
    if (lastErr || !userId) return json({ error: 'falha_conta', detail: lastErr ?? 'sem user id' }, 500);

    // ── Acesso ────────────────────────────────────────────────────
    const expiresAt = accessType === 'aluna' ? computeExpiresAt(duration) : null;

    if (accessType === 'aluna') {
      // external_id determinístico: reliberar o mesmo e-mail ATUALIZA a
      // linha em vez de criar assinatura duplicada.
      const { error: subErr } = await admin.from('subscriptions').upsert({
        user_id: userId,
        email,
        status: 'active',
        provider: 'manual',
        plan_type: 'annual',
        external_id: `manual:${email}`,
        expires_at: expiresAt,
        raw_payload: {
          manual: true,
          granted_by: caller.id,
          granted_by_email: caller.email ?? null,
          duration,
          full_name: fullName,
        },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'provider,external_id' });
      if (subErr) return json({ error: 'erro_assinatura', detail: subErr.message }, 500);
    } else {
      // Expert = acesso total + painel admin. O gate de login já libera
      // quem tem esse papel (ver src/lib/subscription.ts), então não
      // cria assinatura: tirar o papel tira o acesso.
      const { error: roleInsErr } = await admin
        .from('user_roles')
        .upsert({ user_id: userId, role: 'expert' }, { onConflict: 'user_id,role' });
      if (roleInsErr) return json({ error: 'erro_papel', detail: roleInsErr.message }, 500);
    }

    // ── Auditoria (sem a senha) ───────────────────────────────────
    await admin.from('access_grants').insert({
      email,
      target_user_id: userId,
      granted_by: caller.id,
      granted_by_email: caller.email ?? null,
      access_type: accessType,
      action,
      expires_at: expiresAt,
    }).then(() => {}, () => {});

    return json({ ok: true, email, password, action, accessType, expiresAt });
  } catch (err) {
    return json({ error: 'erro_inesperado', detail: String(err instanceof Error ? err.message : err) }, 500);
  }
});
