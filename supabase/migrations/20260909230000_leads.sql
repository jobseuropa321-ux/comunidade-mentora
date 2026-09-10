-- ═══════════════════════════════════════════════════════════════════
-- LEADS · formulários comerciais e de suporte
--
--   tipo = 'mentoria' → aplicação pra acompanhamento do time (/mentoria),
--                       termina no WhatsApp comercial.
--   tipo = 'suporte'  → pedido de ajuda (/suporte), termina no grupo.
--
-- Diferente da ficha de matrícula, aqui pode haver várias linhas por
-- pessoa (suporte é recorrente) e não há edição depois. Os campos comuns
-- ficam em coluna; as perguntas específicas de cada formulário vão em
-- `respostas` (jsonb), então trocar pergunta não pede migration.
--
-- origem = 'app' (logada, pelo botão na aula) | 'link' (página pública).
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.leads (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tipo       text NOT NULL CHECK (tipo IN ('mentoria', 'suporte')),
  origem     text NOT NULL DEFAULT 'app' CHECK (origem IN ('app', 'link')),
  email      text,
  nome       text NOT NULL,
  whatsapp   text NOT NULL,
  instagram  text,
  respostas  jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Aluna logada registra em nome dela.
DROP POLICY IF EXISTS leads_insert_own ON public.leads;
CREATE POLICY leads_insert_own ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Visitante (link público) só insere, sem dono, marcado como 'link'.
DROP POLICY IF EXISTS leads_insert_link ON public.leads;
CREATE POLICY leads_insert_link ON public.leads
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL AND origem = 'link');

-- Só a equipe lê. Ninguém edita/apaga pelo app.
DROP POLICY IF EXISTS leads_select_expert ON public.leads;
CREATE POLICY leads_select_expert ON public.leads
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'expert'::public.app_role));

CREATE INDEX IF NOT EXISTS leads_tipo_created_idx ON public.leads (tipo, created_at DESC);
