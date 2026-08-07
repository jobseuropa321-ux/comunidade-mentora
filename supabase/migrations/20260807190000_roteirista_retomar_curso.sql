-- ═══════════════════════════════════════════════════════════════════
-- ROTEIRISTA · retomar o curso de onde parou
--
-- Antes, sair da tela zerava a conversa: a aula 12 estava salva na
-- Biblioteca, mas o app não sabia mais que ela era a aula 12 DAQUELE
-- esqueleto — só existia o título ("Curso — Aula 12"), que a aluna
-- pode renomear, repetir ou escrever à mão.
--
-- Duas colunas resolvem sem tabela nova: a aula passa a apontar pro
-- esqueleto que a gerou e guarda o próprio número. Daí sai tudo:
--   · o quanto já foi feito (max(lesson_number) por esqueleto)
--   · a conversa pra remontar na tela (as aulas em ordem)
--
-- Ficam nulas nas linhas antigas e em tudo que não for aula do
-- Roteirista — o backfill embaixo recupera só o que dá pra afirmar
-- com certeza pelo título exato "<esqueleto> — Aula N".
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.saved_viral_outputs
  ADD COLUMN IF NOT EXISTS skeleton_id   uuid REFERENCES public.saved_viral_outputs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lesson_number int;

-- Quem já leu a tabela continua lendo: RLS é a mesma (dono da linha).
CREATE INDEX IF NOT EXISTS saved_outputs_skeleton_idx
  ON public.saved_viral_outputs (user_id, skeleton_id, lesson_number);

-- ── Backfill conservador ────────────────────────────────────────────
-- Só liga aula ↔ esqueleto quando o título bate exatamente com
-- "<título do esqueleto> — Aula N" (o formato que o salvamento
-- automático usa) e o esqueleto é do mesmo dono. Título editado à mão
-- ("— aula módulo 3 aula 2") fica de fora de propósito: chutar aqui
-- misturaria aula de curso errado.
UPDATE public.saved_viral_outputs AS aula
SET skeleton_id   = esq.id,
    lesson_number = (regexp_match(aula.title, '^(.*) — Aula (\d{1,3})$'))[2]::int
FROM public.saved_viral_outputs AS esq
WHERE aula.model_slug = 'agente-2'
  AND aula.skeleton_id IS NULL
  AND aula.title ~ '^.+ — Aula \d{1,3}$'
  AND esq.model_slug = 'agente-1'
  AND esq.user_id = aula.user_id
  AND esq.title = (regexp_match(aula.title, '^(.*) — Aula (\d{1,3})$'))[1];
