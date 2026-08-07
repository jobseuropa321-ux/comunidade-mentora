-- ═══════════════════════════════════════════════════════════════════
-- ASCENSÃO · funil do Viral em 1 Minuto
--
-- Três passos, um evento por clique (não é "1 linha por pessoa"):
--   'modulo' → clicou no card do Viral 1 Min na Home
--   'vsl'    → abriu a página da oferta (a aula com a VSL)
--   'cta'    → clicou no botão que vai pro checkout da Hubla
--
-- A aba Ascensão do admin lê SÓ pela RPC `ascension_stats` (agrega no
-- banco). O SELECT direto fica com os experts porque a tabela tem
-- user_id — dado de aluna não pode vazar pro cliente comum.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ascension_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  event      text NOT NULL CHECK (event IN ('modulo', 'vsl', 'cta')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ascension_events ENABLE ROW LEVEL SECURITY;

-- A aluna só consegue registrar evento em nome dela mesma.
DROP POLICY IF EXISTS ascension_insert_own ON public.ascension_events;
CREATE POLICY ascension_insert_own ON public.ascension_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS ascension_select_expert ON public.ascension_events;
CREATE POLICY ascension_select_expert ON public.ascension_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'expert'::public.app_role));

CREATE INDEX IF NOT EXISTS ascension_events_event_created_idx
  ON public.ascension_events (event, created_at DESC);
CREATE INDEX IF NOT EXISTS ascension_events_user_event_idx
  ON public.ascension_events (user_id, event);

-- ── Números da aba (só expert) ──────────────────────────────────────
-- _days NULL = desde o começo; senão janela corrida de N dias.
CREATE OR REPLACE FUNCTION public.ascension_stats(_days int DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  desde     timestamptz;
  numeros   jsonb;
  ultimos   jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'expert'::public.app_role) THEN
    RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501';
  END IF;

  desde := CASE
    WHEN _days IS NULL THEN '-infinity'::timestamptz
    ELSE now() - make_interval(days => _days)
  END;

  SELECT jsonb_build_object(
    'modulo', jsonb_build_object(
      'pessoas', COUNT(DISTINCT user_id) FILTER (WHERE event = 'modulo'),
      'cliques', COUNT(*)                FILTER (WHERE event = 'modulo')),
    'vsl', jsonb_build_object(
      'pessoas', COUNT(DISTINCT user_id) FILTER (WHERE event = 'vsl'),
      'cliques', COUNT(*)                FILTER (WHERE event = 'vsl')),
    'cta', jsonb_build_object(
      'pessoas', COUNT(DISTINCT user_id) FILTER (WHERE event = 'cta'),
      'cliques', COUNT(*)                FILTER (WHERE event = 'cta'))
  )
  INTO numeros
  FROM public.ascension_events
  WHERE created_at >= desde;

  -- Quem clicou no botão (pra dar sequência no atendimento).
  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
  INTO ultimos
  FROM (
    SELECT p.full_name AS nome, e.created_at AS quando
    FROM public.ascension_events e
    LEFT JOIN public.profiles p ON p.user_id = e.user_id
    WHERE e.event = 'cta' AND e.created_at >= desde
    ORDER BY e.created_at DESC
    LIMIT 30
  ) t;

  RETURN numeros || jsonb_build_object('periodo_dias', _days, 'ultimos_cta', ultimos);
END;
$function$;

REVOKE ALL ON FUNCTION public.ascension_stats(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ascension_stats(int) TO authenticated;
