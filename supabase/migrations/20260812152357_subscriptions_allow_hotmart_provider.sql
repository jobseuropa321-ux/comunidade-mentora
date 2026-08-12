-- Libera 'hotmart' como provider válido em subscriptions.
--
-- BLOQUEADOR do webhook: o CHECK atual em produção aceita apenas
-- ('hubla','cakto','manual'), então todo insert do hotmart-webhook falha
-- com violação de constraint e a compra não libera acesso.
--
-- Verificado no banco de produção em 2026-08-12:
--   CHECK ((provider = ANY (ARRAY['hubla'::text, 'cakto'::text, 'manual'::text])))

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_provider_check;

ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_provider_check
  CHECK (provider = ANY (ARRAY['hubla'::text, 'cakto'::text, 'manual'::text, 'hotmart'::text]));
