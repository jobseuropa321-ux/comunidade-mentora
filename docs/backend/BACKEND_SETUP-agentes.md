# Agentes IA + Biblioteca — Setup de Backend (Supabase)

> Instruções pro Claude Code do app novo. Esta seção tem **frontend + banco + edge functions**.
> Siga na ordem: **1) SQL → 2) deploy das functions → 3) secrets → 4) prompts**.

## Arquitetura (como funciona)

```
Chat.tsx ──invoke──▶ edge function `chat-viral`
                       │ 1. valida JWT
                       │ 2. checa limite de mensagens da sessão (10)
                       │ 3. consome cota diária → RPC consume_ai_quota (banco)
                       │ 4. lê o PROMPT do agente na tabela `viral_models`
                       │    (via service_role — o frontend NUNCA vê o prompt)
                       │ 5. chama a OpenAI e devolve { reply }
                       ▼
                   OpenAI (modelo configurável no topo da function)

Botão "Salvar" ──▶ tabela `saved_viral_outputs` (a Biblioteca lê/edita daqui)
Botão de microfone ──▶ edge function `transcribe-audio` (Whisper)
```

| Recurso | Pra quê |
|---|---|
| `viral_models` | **os prompts dos 4 agentes** (1 linha por agente, chave = slug) |
| `saved_viral_outputs` | roteiros salvos → tela Biblioteca |
| `ai_usage_log` + RPC `consume_ai_quota` | cota diária de conversas (1 sessão de chat = 1 crédito) |
| `user_roles` + `has_role` | papéis `expert`/`tester` têm **cota ilimitada** (bypass) |
| function `chat-viral` | o cérebro: prompt + histórico → OpenAI |
| function `transcribe-audio` | voz → texto no input do chat (Whisper) |

---

## 1) SQL — cole TUDO no SQL Editor do Supabase

```sql
-- ═══════════════════════════════════════════════════════════════
-- A) PAPÉIS (expert/tester = cota ilimitada).
--    Rode esta seção MESMO que user_roles já exista em outra parte
--    do app — tudo aqui é idempotente, e a função consume_ai_quota
--    (seção D) depende de has_role e dos valores 'expert'/'tester'
--    no enum. Só pule o que você tiver certeza que já é idêntico.
-- ═══════════════════════════════════════════════════════════════
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('aluna', 'expert', 'tester');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Se o enum já existia sem esses valores, garante que existam:
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'expert';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'tester';

CREATE TABLE IF NOT EXISTS public.user_roles (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role    public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ═══════════════════════════════════════════════════════════════
-- B) PROMPTS DOS AGENTES — tabela viral_models
--    ⚠️ RLS ligada SEM policy de leitura: só a service_role
--    (edge function) consegue ler. O prompt nunca vaza pro app.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.viral_models (
  slug       TEXT PRIMARY KEY,     -- tem que bater com o slug em src/data/agents.ts
  name       TEXT NOT NULL,        -- só informativo (o nome exibido vem do frontend)
  prompt     TEXT NOT NULL,        -- o system prompt do agente
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.viral_models ENABLE ROW LEVEL SECURITY;
-- (sem CREATE POLICY de propósito — leitura só via service_role)

-- Semeia os 4 agentes com prompt placeholder (troque via PROMPTS_DOS_AGENTES.md)
INSERT INTO public.viral_models (slug, name, prompt) VALUES
  ('agente-1', 'Agente 1', 'PLACEHOLDER — cole o prompt real deste agente (PROMPTS_DOS_AGENTES.md)'),
  ('agente-2', 'Agente 2', 'PLACEHOLDER — cole o prompt real deste agente (PROMPTS_DOS_AGENTES.md)'),
  ('agente-3', 'Agente 3', 'PLACEHOLDER — cole o prompt real deste agente (PROMPTS_DOS_AGENTES.md)'),
  ('agente-4', 'Agente 4', 'PLACEHOLDER — cole o prompt real deste agente (PROMPTS_DOS_AGENTES.md)')
ON CONFLICT (slug) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- C) BIBLIOTECA — saved_viral_outputs (cada usuário só vê os seus)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.saved_viral_outputs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model_slug  TEXT NOT NULL,
  model_name  TEXT NOT NULL,
  title       TEXT NOT NULL,
  user_input  TEXT NOT NULL,     -- o briefing que o usuário mandou
  ai_response TEXT NOT NULL,     -- a resposta da IA (editável na Biblioteca)
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_saved_outputs_user_model
  ON public.saved_viral_outputs (user_id, model_slug);

ALTER TABLE public.saved_viral_outputs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "outputs_select_own" ON public.saved_viral_outputs;
DROP POLICY IF EXISTS "outputs_insert_own" ON public.saved_viral_outputs;
DROP POLICY IF EXISTS "outputs_update_own" ON public.saved_viral_outputs;
DROP POLICY IF EXISTS "outputs_delete_own" ON public.saved_viral_outputs;
CREATE POLICY "outputs_select_own" ON public.saved_viral_outputs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "outputs_insert_own" ON public.saved_viral_outputs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "outputs_update_own" ON public.saved_viral_outputs
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "outputs_delete_own" ON public.saved_viral_outputs
  FOR DELETE USING (auth.uid() = user_id);

-- mantém updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS update_saved_outputs_updated_at ON public.saved_viral_outputs;
CREATE TRIGGER update_saved_outputs_updated_at
  BEFORE UPDATE ON public.saved_viral_outputs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS update_viral_models_updated_at ON public.viral_models;
CREATE TRIGGER update_viral_models_updated_at
  BEFORE UPDATE ON public.viral_models
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- D) COTA DE IA — ai_usage_log + consume_ai_quota
--    1 sessão de chat inteira = 1 crédito (mensagens seguintes da
--    mesma sessão são grátis). Falha depois de logar não estorna
--    (igual ao comportamento original do chat).
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,               -- 'chat-viral' (adicione outros kinds no futuro)
  segment    TEXT,                        -- categoria do agente (só estatística)
  session_id UUID,                        -- id da sessão de chat (dedup de cota)
  status     TEXT NOT NULL DEFAULT 'ok',  -- 'ok' | 'failed' (failed não conta pro limite)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_kind_day
  ON public.ai_usage_log (user_id, kind, created_at);

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usage_select_own" ON public.ai_usage_log;
CREATE POLICY "usage_select_own" ON public.ai_usage_log
  FOR SELECT USING (auth.uid() = user_id);
-- (sem INSERT policy de propósito: só a RPC SECURITY DEFINER insere)

CREATE OR REPLACE FUNCTION public.consume_ai_quota(
  _kind text,
  _segment text DEFAULT NULL::text,
  _session_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  uid UUID;
  bypass_limits BOOLEAN;
  used INT;
  daily_limit INT;
  session_already_logged BOOLEAN := false;
  day_start TIMESTAMPTZ;
  new_id UUID;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'not_authenticated');
  END IF;

  -- Serializa chamadas concorrentes do mesmo usuário+kind (evita passar
  -- do limite com N requests simultâneos e evita duplicar a mesma sessão).
  -- O lock solta sozinho no fim da transação.
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text || ':' || _kind, 0));

  -- expert/tester = ilimitado
  bypass_limits := public.has_role(uid, 'expert'::public.app_role)
                OR public.has_role(uid, 'tester'::public.app_role);
  IF bypass_limits THEN
    RETURN jsonb_build_object('allowed', true, 'unlimited', true);
  END IF;

  -- Mesma sessão de chat já logada → não consome crédito de novo
  IF _kind = 'chat-viral' AND _session_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM ai_usage_log
      WHERE user_id = uid AND session_id = _session_id
    ) INTO session_already_logged;

    IF session_already_logged THEN
      RETURN jsonb_build_object('allowed', true, 'session_existing', true);
    END IF;
  END IF;

  -- ⚙️ LIMITES DIÁRIOS — mexa aqui (e adicione novos kinds se precisar)
  daily_limit := CASE _kind
    WHEN 'chat-viral' THEN 50    -- conversas de agente por dia (sessões novas)
    ELSE 0
  END;

  day_start := date_trunc('day', NOW());

  IF _kind = 'chat-viral' THEN
    -- COALESCE(session_id, id): linha sem session_id conta como sessão
    -- própria — senão chamadas com session NULL nunca contariam pro
    -- limite (cota infinita se alguém chamar a RPC direto).
    SELECT COUNT(DISTINCT COALESCE(session_id, id))::INT
      FROM ai_usage_log
      WHERE user_id = uid
        AND kind = 'chat-viral'
        AND status = 'ok'
        AND created_at >= day_start
      INTO used;
  ELSE
    SELECT COUNT(*)::INT
      FROM ai_usage_log
      WHERE user_id = uid
        AND kind = _kind
        AND status = 'ok'
        AND created_at >= day_start
      INTO used;
  END IF;

  IF used >= daily_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'daily_limit_reached',
      'used', used,
      'limit', daily_limit
    );
  END IF;

  INSERT INTO ai_usage_log (user_id, kind, segment, session_id)
    VALUES (uid, _kind, _segment, _session_id)
    RETURNING id INTO new_id;

  RETURN jsonb_build_object(
    'allowed', true,
    'usage_id', new_id,
    'used', used + 1,
    'limit', daily_limit,
    'remaining', daily_limit - used - 1
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.consume_ai_quota(text, text, uuid) TO authenticated;
```

---

## 2) Deploy das edge functions

As duas functions estão em `supabase/functions/` deste pacote. Copie a pasta
`supabase/functions/chat-viral` e `supabase/functions/transcribe-audio` pro
projeto e rode (precisa do [Supabase CLI](https://supabase.com/docs/guides/cli)
com o projeto linkado — `supabase link --project-ref SEU_REF`):

```bash
supabase functions deploy chat-viral
supabase functions deploy transcribe-audio
```

## 3) Secrets (variáveis das functions)

```bash
supabase secrets set OPENAI_API_KEY=sk-SUACHAVE
# opcional, trava o CORS na origem do app em produção:
supabase secrets set ALLOWED_ORIGIN=https://seuapp.com
```
(`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` já são
injetadas automaticamente pelo Supabase — não precisa setar.)

## 4) Prompts

Siga o **PROMPTS_DOS_AGENTES.md** — é 1 UPDATE por agente.

---

## Onde mexer em cada coisa (mapa de configuração)

| Quero mudar… | Onde |
|---|---|
| O **prompt** de um agente | `UPDATE viral_models` (PROMPTS_DOS_AGENTES.md) — sem deploy |
| Nome/descrição/ícone/cor/abertura de um agente | `src/data/agents.ts` (frontend) |
| **Adicionar um 5º agente** | 1 objeto em `agents.ts` + 1 INSERT em `viral_models` |
| O **modelo** da OpenAI | `MODEL` no topo de `chat-viral/index.ts` → redeploy |
| Máx de **mensagens por conversa** (10) | `MAX_MESSAGES_PER_SESSION` na mesma function → redeploy |
| **Cota diária** de conversas (50) | o `CASE` dentro de `consume_ai_quota` (SQL) — sem deploy |
| Dar **cota ilimitada** a alguém | `INSERT INTO user_roles (user_id, role) VALUES ('<uuid>', 'expert');` |
| Tamanho máx da resposta (6000 tokens) | `MAX_COMPLETION_TOKENS` na function → redeploy |
| O agente **Analisar Meu Perfil** (agente-12) | não usa `viral_models` nem `chat-viral` — ver **BACKEND_SETUP-analisar-perfil.md** |

## Variáveis do frontend (.env)

```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=SUA-ANON-KEY
```

## Trocar o mock pelo Supabase real
Igual aos outros pacotes: apague `src/contexts/AuthContext.tsx` (mock) e renomeie
`AuthContext.supabase.tsx` → `AuthContext.tsx`. O chat precisa de usuário logado
de verdade pra IA responder (a function valida o JWT).
