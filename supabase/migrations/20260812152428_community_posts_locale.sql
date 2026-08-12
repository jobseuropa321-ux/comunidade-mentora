-- Comunidade separada por idioma.
--
-- DEFAULT 'pt' (e não 'es' como no SQL do kit) porque a base atual do DAM é
-- inteiramente portuguesa: os posts que já existem precisam continuar
-- aparecendo para quem está em /community.
--
-- Diferenças de propósito em relação ao app original, que não tem nenhuma
-- das duas: CHECK e ÍNDICE.
--   * sem CHECK, um bug de casing no frontend grava 'ES' ou 'es-ES' e cria
--     uma comunidade fantasma, invisível para os dois idiomas;
--   * sem índice, a query (que é sempre WHERE locale = ? ORDER BY created_at
--     DESC LIMIT n) varre a tabela inteira.

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'pt';

ALTER TABLE public.community_posts DROP CONSTRAINT IF EXISTS community_posts_locale_check;
ALTER TABLE public.community_posts ADD CONSTRAINT community_posts_locale_check
  CHECK (locale IN ('pt', 'es'));

CREATE INDEX IF NOT EXISTS community_posts_locale_created_idx
  ON public.community_posts (locale, created_at DESC);

-- ATENÇÃO: isto é separação COSMÉTICA, não segurança. A policy de SELECT
-- continua valendo para os dois idiomas, então qualquer aluno consegue ler os
-- posts do outro idioma chamando o PostgREST direto. Se a separação precisar
-- ser real, ela tem que estar escrita na policy — e aí vale conferir de onde
-- vem o idioma do usuário, já que aqui ele vem da URL, não do perfil.

-- A view que o feed consome lista as colunas UMA A UMA, então adicionar a
-- coluna na tabela não basta: sem recriar a view, `locale` simplesmente não
-- chega no frontend e o filtro por idioma vira no-op silencioso.
-- (Definição capturada do banco de produção em 2026-08-12 e mantida idêntica,
--  com `p.locale` acrescentado no fim para não alterar a ordem das colunas.)
CREATE OR REPLACE VIEW public.community_posts_enriched AS
 SELECT p.id,
    p.user_id,
    p.content,
    p.image_url,
    p.created_at,
    pr.full_name,
    pr.avatar_url,
    pr.instagram,
    ( SELECT count(*) AS count
           FROM community_likes l
          WHERE l.post_id = p.id) AS likes_count,
    ( SELECT count(*) AS count
           FROM community_comments c
          WHERE c.post_id = p.id) AS comments_count,
    p.locale
   FROM community_posts p
     LEFT JOIN profiles pr ON pr.user_id = p.user_id;
