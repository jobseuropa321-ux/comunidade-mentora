/* ═══════════════════════════════════════════════════════════════
   GATE DE ACESSO — só entra quem tem assinatura ativa.

   Logar no Supabase Auth NÃO basta: depois do login (e ao restaurar
   sessão) o app chama checkSubscription() e desloga quem não tem
   assinatura 'active'. A fonte da verdade é a tabela `subscriptions`,
   escrita SÓ pela edge function `hubla-webhook` (service role).

   Replicado de `modulos/acesso/kit-acesso-hubla-resend/`.
   ═══════════════════════════════════════════════════════════════ */
import { supabase } from '@/integrations/supabase/client';

export type SubStatus = 'active' | 'cancelled' | 'expired' | 'refunded' | 'not_found';

/** Títulos curtos usados pelo alerta de bloqueio na tela de login. */
export const SUB_DENIED_TITLE: Record<Exclude<SubStatus, 'active'>, string> = {
  not_found: 'Acesso não liberado',
  cancelled: 'Assinatura cancelada',
  expired: 'Período de acesso encerrado',
  refunded: 'Compra reembolsada',
};

/** Mensagens mostradas na tela de login quando o acesso é negado. */
export const SUB_DENIED_MSG: Record<Exclude<SubStatus, 'active'>, string> = {
  not_found: 'Não encontramos uma compra com esse e-mail. Use o mesmo e-mail que você usou na compra.',
  cancelled: 'Sua assinatura foi cancelada e o acesso está encerrado. Se isso for engano, fale com o suporte.',
  expired: 'O período contratado para este e-mail terminou. Para voltar a acessar, renove sua assinatura.',
  refunded: 'Sua compra foi reembolsada, então o acesso foi encerrado.',
};

/** Erro de acesso negado — a tela de login mostra a mensagem dele ao usuário.
 *  (Erros crus do Supabase Auth NÃO são exibidos: vêm em inglês e vazam detalhe.) */
export class AccessDeniedError extends Error {
  readonly accessDenied = true;
  constructor(message: string) {
    super(message);
    this.name = 'AccessDeniedError';
  }
}

export const isAccessDenied = (e: unknown): e is AccessDeniedError =>
  typeof e === 'object' && e !== null && (e as { accessDenied?: boolean }).accessDenied === true;

export const checkSubscription = async (email: string): Promise<SubStatus> => {
  // Escape hatch de dev: VITE_BYPASS_SUBSCRIPTION=true no .env local
  if (import.meta.env.VITE_BYPASS_SUBSCRIPTION === 'true') return 'active';

  // Bypass de equipe: quem tem role expert/tester entra sem assinatura.
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.email?.toLowerCase() === email.toLowerCase()) {
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['expert', 'tester']);
    if (roles && roles.length > 0) return 'active';
  }

  // RPC SECURITY DEFINER com grant pra anon — dá pra checar até antes de logar.
  const { data, error } = await supabase.rpc('check_email_subscription', {
    check_email: email,
  });
  if (error) return 'not_found';

  const status = data as string;
  if (status === 'active') return 'active';
  if (status === 'canceled') return 'cancelled';
  if (status === 'expired') return 'expired';
  if (status === 'refunded') return 'refunded';
  return 'not_found';
};
