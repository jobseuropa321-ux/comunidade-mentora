-- ═══════════════════════════════════════════════════════════════════
-- COTA DIÁRIA DO AGENTE "ANALISAR MEU PERFIL" (agente-12)
--
-- A tabela `ai_usage_log` e a RPC `consume_ai_quota` JÁ EXISTIAM (chat-viral).
-- Esta migration só acrescenta o kind novo no CASE + um teto de tentativas.
--
-- ⚠️ Kind fora do CASE cai no `ELSE 0` = limite zero = a ferramenta nasce
--    sempre bloqueada, com a tela dizendo "você já usou suas análises de hoje"
--    logo na primeira vez. É a pegadinha nº1 do kit.
--
-- O que MUDA em relação à versão anterior da função:
--   1. `WHEN 'analisar-perfil' THEN 5`
--   2. teto de TENTATIVAS (3x o limite, contando as 'failed') pros kinds que
--      não são 'chat-viral' — sem isso, quem entra num loop de erro chama a
--      OpenAI infinitas vezes de graça (as linhas 'failed' são estornadas).
-- Todo o resto do corpo é idêntico ao que já estava em produção.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.consume_ai_quota(
  _kind       text,
  _segment    text DEFAULT NULL::text,
  _session_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid UUID;
  bypass_limits BOOLEAN;
  used INT;
  attempts INT;
  daily_limit INT;
  session_already_logged BOOLEAN := false;
  day_start TIMESTAMPTZ;
  new_id UUID;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'not_authenticated');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text || ':' || _kind, 0));

  bypass_limits := public.has_role(uid, 'expert'::public.app_role)
                OR public.has_role(uid, 'tester'::public.app_role);
  IF bypass_limits THEN
    RETURN jsonb_build_object('allowed', true, 'unlimited', true);
  END IF;

  IF _kind = 'chat-viral' AND _session_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM ai_usage_log
      WHERE user_id = uid AND session_id = _session_id
    ) INTO session_already_logged;

    IF session_already_logged THEN
      RETURN jsonb_build_object('allowed', true, 'session_existing', true);
    END IF;
  END IF;

  daily_limit := CASE _kind
    WHEN 'chat-viral'      THEN 50
    WHEN 'analisar-perfil' THEN 5
    ELSE 0
  END;

  day_start := date_trunc('day', NOW());

  IF _kind = 'chat-viral' THEN
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

  -- Teto de TENTATIVAS (conta as 'failed' estornadas). Só pros kinds de
  -- chamada única — 'chat-viral' cobra por sessão e já tem teto próprio.
  IF _kind <> 'chat-viral' THEN
    SELECT COUNT(*)::INT
      FROM ai_usage_log
      WHERE user_id = uid
        AND kind = _kind
        AND created_at >= day_start
      INTO attempts;

    IF attempts >= daily_limit * 3 THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'daily_limit_reached',
        'used', used,
        'limit', daily_limit
      );
    END IF;
  END IF;

  INSERT INTO ai_usage_log (user_id, kind, segment, session_id)
    VALUES (uid, _kind, _segment, _session_id)
    RETURNING id INTO new_id;

  RETURN jsonb_build_object(
    'allowed', true,
    'usage_id', new_id,          -- a edge function guarda pra poder estornar
    'used', used + 1,
    'limit', daily_limit,
    'remaining', daily_limit - used - 1
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.consume_ai_quota(text, text, uuid) TO authenticated;
