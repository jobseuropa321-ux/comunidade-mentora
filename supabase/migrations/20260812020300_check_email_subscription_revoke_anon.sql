-- Fecha a enumeração da base de clientes.
--
-- O PROBLEMA: check_email_subscription é SECURITY DEFINER e tem EXECUTE para
-- `anon`. Como a chave anônima do Supabase está no bundle do frontend, qualquer
-- pessoa pode chamar a RPC com um e-mail arbitrário e descobrir se aquele
-- e-mail é cliente — e, pelo status devolvido, se cancelou ou pediu reembolso.
-- Confirmado em produção em 2026-08-12:
--   has_function_privilege('anon', 'public.check_email_subscription(text)', 'EXECUTE') = true
--
-- POR QUE É SEGURO REVOGAR NESTE APP (verificado no código, não presumido):
-- `checkSubscription()` em src/lib/subscription.ts tem UM único chamador,
-- `validateAndPublishSession(nextSession)` em src/contexts/AuthContext.tsx, que
-- só roda com uma Session em mãos — ou logo depois de signInWithPassword ter
-- retornado sessão, ou a partir do onAuthStateChange com nextSession. Nos dois
-- casos o supabase-js já está mandando o JWT de `authenticated`.
-- O comentário em subscription.ts ("dá pra checar até antes de logar") descreve
-- uma capacidade que o app NÃO usa.
--
-- ANTES DE APLICAR, confirme que isso continua verdade:
--   grep -rn "check_email_subscription" src/
-- Se aparecer qualquer chamada fora do fluxo autenticado, NÃO aplique: vai
-- derrubar o login de todo mundo, e o sintoma é a tela de login dizendo
-- "acesso não liberado" para clientes em dia.

REVOKE EXECUTE ON FUNCTION public.check_email_subscription(text) FROM anon;

-- O REVOKE de PUBLIC é necessário à parte: no Supabase, ALTER DEFAULT
-- PRIVILEGES concede nominalmente, então tirar só de `anon` pode não bastar.
REVOKE EXECUTE ON FUNCTION public.check_email_subscription(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.check_email_subscription(text) TO authenticated;

-- Confira depois de aplicar (deve devolver false, e a segunda true):
--   SELECT has_function_privilege('anon','public.check_email_subscription(text)','EXECUTE');
--   SELECT has_function_privilege('authenticated','public.check_email_subscription(text)','EXECUTE');
