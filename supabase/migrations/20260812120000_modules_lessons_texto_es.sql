-- Texto do conteúdo em espanhol (APLICADA em 2026-08-12).
--
-- Só para os campos de TEXTO ÚNICO por registro. Os campos de lista fechada
-- (nivel, tag, instructor, duracao) NÃO ganham coluna: assumem um punhado de
-- valores e são resolvidos pelo dicionário do frontend (src/lib/dbText.ts),
-- com o próprio valor como fallback — assim duração numérica ("1h 12min") e
-- qualquer valor novo cadastrado no painel continuam aparecendo.
--
-- NULL cai no texto em português: módulo sem tradução aparece no idioma
-- original em vez de sumir da tela.

ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS title1_es text,
  ADD COLUMN IF NOT EXISTS title2_es text,
  ADD COLUMN IF NOT EXISTS descricao_es text;

ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS titulo_es text,
  ADD COLUMN IF NOT EXISTS descricao_es text,
  ADD COLUMN IF NOT EXISTS conteudo_es text;

COMMENT ON COLUMN public.modules.title1_es IS 'Título (linha 1) em espanhol. NULL cai no title1.';
COMMENT ON COLUMN public.modules.title2_es IS 'Título (linha 2) em espanhol. NULL cai no title2.';
COMMENT ON COLUMN public.modules.descricao_es IS 'Descrição em espanhol. NULL cai na descricao.';
COMMENT ON COLUMN public.lessons.titulo_es IS 'Título da aula em espanhol. NULL cai no titulo.';
COMMENT ON COLUMN public.lessons.descricao_es IS 'Descrição da aula em espanhol. NULL cai na descricao.';
COMMENT ON COLUMN public.lessons.conteudo_es IS 'Resumo/conteúdo da aula em espanhol. NULL cai no conteudo.';
