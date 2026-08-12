-- Capa de módulo em espanhol.
--
-- O guia do kit descreve duas convenções no app original (pasta espelho
-- /covers/es/ com fallback no onError, e esta coluna) e recomenda escolher
-- uma. Escolhida a coluna: permite trocar a capa sem deploy e não depende de
-- um 404 acontecer para descobrir que a imagem não existe.
--
-- No app original esta coluna foi criada na mão pelo dashboard e não existe em
-- migration nenhuma: um `supabase db reset` gerava um banco sem ela e o app ES
-- quebrava. Por isso ela está versionada aqui.

ALTER TABLE public.modules ADD COLUMN IF NOT EXISTS cover_url_es text;

COMMENT ON COLUMN public.modules.cover_url_es IS
  'Capa exibida quando a URL está em /es. NULL cai no cover_url normal.';
