-- ═══════════════════════════════════════════════════════════════════
-- MATRÍCULAS · ficha de matrícula da aluna
--
-- Preenchida uma vez, na primeira aula de "Comece por aqui" (/matricula).
-- Quem preenche tudo ganha o ingresso do evento exclusivo — o botão do
-- grupo aparece no fim do formulário.
--
-- Uma linha por aluna (unique em user_id): reabrir a ficha edita a mesma
-- linha em vez de duplicar. O e-mail vai gravado junto porque auth.users
-- não é legível pelo app, e a exportação do admin precisa dele.
--
-- A aba Matrículas do admin lê a tabela inteira (só expert) e exporta CSV.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.matriculas (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  email             text,
  nome              text NOT NULL,
  whatsapp          text NOT NULL,
  instagram         text,
  cidade            text,
  idade             text,
  area_atuacao      text NOT NULL,
  tempo_atuacao     text,
  onde_atende       text,
  faturamento       text NOT NULL,
  meta_faturamento  text,
  sobre_voce        text,
  maior_dificuldade text,
  motivo_compra     text,
  expectativa       text,
  como_conheceu     text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.matriculas ENABLE ROW LEVEL SECURITY;

-- A aluna cria, lê e edita SÓ a própria ficha.
DROP POLICY IF EXISTS matriculas_insert_own ON public.matriculas;
CREATE POLICY matriculas_insert_own ON public.matriculas
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS matriculas_select_own ON public.matriculas;
CREATE POLICY matriculas_select_own ON public.matriculas
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS matriculas_update_own ON public.matriculas;
CREATE POLICY matriculas_update_own ON public.matriculas
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- A equipe (expert) vê todas — é o que alimenta a aba Matrículas e o CSV.
DROP POLICY IF EXISTS matriculas_select_expert ON public.matriculas;
CREATE POLICY matriculas_select_expert ON public.matriculas
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'expert'::public.app_role));

CREATE INDEX IF NOT EXISTS matriculas_created_idx ON public.matriculas (created_at DESC);

-- updated_at automático na edição.
CREATE OR REPLACE FUNCTION public.matriculas_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS matriculas_touch_updated_at ON public.matriculas;
CREATE TRIGGER matriculas_touch_updated_at
  BEFORE UPDATE ON public.matriculas
  FOR EACH ROW EXECUTE FUNCTION public.matriculas_touch_updated_at();
