import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

/* ─────────────────────────────────────────────────────────────────
   send-push — dispara notificação para os aparelhos de um idioma.

   Quem chama: a aba Notificações da administração. Exige JWT de alguém
   com role `expert` (o mesmo gate das outras telas de admin).

   Corpo esperado:
     { title, body, url?, tag?, lang: 'pt' | 'es', teste?: boolean }

   `lang` NÃO é enfeite: as inscrições guardam o idioma em que a aluna
   estava ao permitir, e mandar texto em português para a versão espanhola
   é o tipo de erro que só aparece depois de já ter chegado no celular.
   `teste: true` manda só para os aparelhos de quem está chamando.

   Segredos necessários (supabase secrets set):
   - VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY — o par que assina o envio;
     a pública PRECISA ser a mesma publicada no front (VITE_VAPID_PUBLIC_KEY),
     senão o push service rejeita com 403 e nada chega.
   - VAPID_SUBJECT — mailto: ou https:// de contato (exigência do protocolo).

   Inscrição morta (404/410 do push service) é apagada na hora: aparelho
   que desinstalou o app fica devolvendo erro pra sempre se ninguém limpa.
───────────────────────────────────────────────────────────────── */

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";

function buildCorsHeaders(origin: string | null) {
  const isLocalhost = !!origin &&
    (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:"));
  return {
    "Access-Control-Allow-Origin": isLocalhost ? origin : ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

interface Inscricao {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

serve(async (req) => {
  const cors = buildCorsHeaders(req.headers.get("origin"));
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
  const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
  const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:contato@comunidadedigital.com.br";
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return json({ error: "vapid_nao_configurado" }, 500);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // 1. Quem está chamando é expert?
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "sem_token" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: userData, error: userErr } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
  if (userErr || !userData?.user) return json({ error: "token_invalido" }, 401);

  const { data: ehExpert, error: roleErr } = await admin.rpc("has_role", {
    _user_id: userData.user.id,
    _role: "expert",
  });
  if (roleErr) return json({ error: "falha_ao_conferir_role", detalhe: roleErr.message }, 500);
  if (!ehExpert) return json({ error: "sem_permissao" }, 403);

  // 2. Conteúdo
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "json_invalido" }, 400);
  }

  const title = String(payload.title ?? "").trim();
  const body = String(payload.body ?? "").trim();
  const lang = payload.lang === "es" ? "es" : "pt";
  const teste = payload.teste === true;
  const url = String(payload.url ?? (lang === "es" ? "/es/home" : "/home"));
  const tag = String(payload.tag ?? "comunidade");

  if (title.length < 2) return json({ error: "titulo_obrigatorio" }, 400);
  if (body.length < 2) return json({ error: "texto_obrigatorio" }, 400);

  // 3. Destinatários
  let query = admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("lang", lang);
  if (teste) query = query.eq("user_id", userData.user.id);

  const { data: inscricoes, error: subErr } = await query;
  if (subErr) return json({ error: "falha_ao_listar", detalhe: subErr.message }, 500);
  if (!inscricoes?.length) return json({ enviadas: 0, falhas: 0, removidas: 0, total: 0 });

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  const conteudo = JSON.stringify({ title, body, url, tag });

  let enviadas = 0;
  let falhas = 0;
  const mortas: string[] = [];

  // Sequencial de propósito: são poucas centenas de aparelhos e disparar tudo
  // de uma vez estoura o limite de conexões da function.
  for (const sub of inscricoes as Inscricao[]) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        conteudo,
      );
      enviadas++;
    } catch (err) {
      const status = (err as { statusCode?: number })?.statusCode;
      // 404/410 = inscrição não existe mais do lado do push service.
      if (status === 404 || status === 410) mortas.push(sub.id);
      else console.warn("send-push: falha", status, (err as Error)?.message);
      falhas++;
    }
  }

  if (mortas.length) {
    await admin.from("push_subscriptions").delete().in("id", mortas);
  }

  return json({
    enviadas,
    falhas,
    removidas: mortas.length,
    total: inscricoes.length,
    lang,
    teste,
  });
});
