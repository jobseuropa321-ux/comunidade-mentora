-- A ficha de matrícula ganha uma versão PÚBLICA (/ficha), sem login, pra
-- captar lead por fora do app. O lead cai na mesma tabela e na mesma aba
-- Matrículas do admin, marcado com origem = 'link'.
--
-- Sem conta não há user_id: a coluna passa a aceitar NULL (o UNIQUE em
-- user_id continua valendo só pras alunas — NULL não colide com NULL).

ALTER TABLE public.matriculas ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.matriculas ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'app'
  CHECK (origem IN ('app', 'link'));

-- Visitante (anon) só INSERE, e só como lead do link, sem user_id. Nada de
-- SELECT/UPDATE: quem preencheu pelo link não vê nem mexe em nada depois.
DROP POLICY IF EXISTS matriculas_insert_link ON public.matriculas;
CREATE POLICY matriculas_insert_link ON public.matriculas
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL AND origem = 'link');

-- Aluna logada preenchendo pelo link público também vale como 'link'
-- (a policy de insert dela já exige user_id = auth.uid()).
CREATE INDEX IF NOT EXISTS matriculas_origem_idx ON public.matriculas (origem, created_at DESC);
