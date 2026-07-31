export type HublaSubscriptionStatus = 'active' | 'canceled' | 'refunded';
export type HublaPlanType = 'annual' | 'monthly';
export type HublaAccessAction = 'activate' | 'cancel_renewal' | 'deactivate' | 'refund';

export interface NormalizedHublaEvent {
  eventType: string;
  format: 'legacy' | 'v2';
  action: HublaAccessAction;
  status: HublaSubscriptionStatus;
  email: string;
  userName: string;
  externalId: string;
  planType: HublaPlanType;
  paidAt: string | null;
  createdAt: string | null;
  expiresAt: string | null;
}

export type HublaParseResult =
  | { kind: 'event'; event: NormalizedHublaEvent }
  | { kind: 'ignored'; eventType: string }
  | { kind: 'error'; message: string };

type JsonRecord = Record<string, unknown>;

export interface HublaWebhookLogCandidate {
  headers?: unknown;
  body?: unknown;
}

const asRecord = (value: unknown): JsonRecord | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : null;

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const firstRecord = (value: unknown): JsonRecord | null => {
  if (!Array.isArray(value) || value.length === 0) return null;
  return asRecord(value[0]);
};

export function mapActionFromType(type: string): HublaAccessAction | null {
  const normalized = type.trim().toLowerCase();

  if (
    normalized === 'newsale'
    || normalized === 'renewedsale'
    || normalized === 'invoice.payment_succeeded'
    || normalized === 'subscription.activated'
    || normalized === 'customer.member_added'
  ) return 'activate';

  if (
    normalized === 'canceledsubscription'
    || normalized === 'subscription.renewal_disabled'
  ) return 'cancel_renewal';

  if (
    normalized === 'canceledsale'
    || normalized === 'subscription.deactivated'
    || normalized === 'customer.member_removed'
  ) return 'deactivate';

  if (
    normalized === 'refundedsale'
    || normalized === 'invoice.refunded'
    || normalized === 'refund_request.accepted'
  ) return 'refund';

  return null;
}

export function mapStatusFromType(type: string): HublaSubscriptionStatus | null {
  const action = mapActionFromType(type);
  if (action === 'activate') return 'active';
  if (action === 'cancel_renewal' || action === 'deactivate') return 'canceled';
  if (action === 'refund') return 'refunded';
  return null;
}

/**
 * Normaliza os dois formatos que a Hubla envia:
 * - v1: event.userEmail / event.transactionId
 * - v2: event.user.email / event.invoice.id
 */
export function parseHublaPayload(body: unknown): HublaParseResult {
  const root = asRecord(body);
  if (!root) return { kind: 'error', message: 'body invalido' };

  const eventType = asString(root.type);
  if (!eventType) return { kind: 'error', message: 'tipo ausente' };

  // Eventos que não alteram acesso são reconhecidos antes da validação dos
  // campos. Assim, um evento informativo novo recebe 200 em vez de gerar retry.
  let action = mapActionFromType(eventType);
  if (!action) return { kind: 'ignored', eventType };

  const event = asRecord(root.event);
  if (!event) return { kind: 'error', message: 'event ausente' };

  const nestedUser = asRecord(event.user);
  const invoice = asRecord(event.invoice);
  const nestedSubscription = asRecord(event.subscription) ?? firstRecord(event.subscriptions);
  const lastInvoice = asRecord(nestedSubscription?.lastInvoice);

  // No legado, CanceledSale também é usado quando um pagamento já concluído
  // foi reembolsado. Nesse caso o bloqueio é terminal, não um mero cancelamento.
  const reason = asString(event.reason)?.toLowerCase();
  if (eventType.trim().toLowerCase() === 'canceledsale' && reason === 'refunded') {
    action = 'refund';
  }

  const status: HublaSubscriptionStatus = action === 'activate'
    ? 'active'
    : action === 'refund'
      ? 'refunded'
      : 'canceled';

  const legacyEmail = asString(event.userEmail);
  const nestedEmail = asString(nestedUser?.email);
  const email = (legacyEmail ?? nestedEmail)?.toLowerCase();
  if (!email) return { kind: 'error', message: 'email ausente' };

  // Fatura é o identificador estável nos eventos invoice/refund. Eventos de
  // assinatura trazem a última fatura; ela permite atualizar a mesma linha.
  const externalId = asString(event.transactionId)
    ?? asString(invoice?.id)
    ?? asString(lastInvoice?.id)
    ?? asString(nestedSubscription?.id);
  if (!externalId) return { kind: 'error', message: 'transaction id ausente' };

  const legacyName = asString(event.userName);
  const firstName = asString(nestedUser?.firstName);
  const lastName = asString(nestedUser?.lastName);
  const nestedName = [firstName, lastName].filter(Boolean).join(' ');

  const recurring = asString(event.recurring);
  const nestedSubscriptionType = asString(nestedSubscription?.type);
  const planType: HublaPlanType =
    recurring === 'one_time_purchased' || nestedSubscriptionType === 'one_time'
      ? 'annual'
      : 'monthly';

  return {
    kind: 'event',
    event: {
      eventType,
      format: legacyEmail ? 'legacy' : 'v2',
      action,
      status,
      email,
      userName: legacyName ?? nestedName,
      externalId,
      planType,
      paidAt: asString(event.paidAt) ?? asString(invoice?.saleDate) ?? asString(lastInvoice?.saleDate),
      createdAt: asString(event.createdAt) ?? asString(invoice?.createdAt) ?? asString(nestedSubscription?.createdAt),
      // invoice.dueDate não é validade do acesso e não pode ser usado aqui.
      expiresAt: asString(event.expiresAt),
    },
  };
}

/**
 * A Hubla costuma mandar a mesma venda em v1 e v2 quase simultaneamente.
 * O v1 continua sendo a fonte preferida porque já é coberto pelo auto-reparo.
 * O token precisa coincidir porque o log é gravado antes da autenticação.
 */
export function hasAuthenticatedLegacyTwin(
  candidates: HublaWebhookLogCandidate[],
  externalId: string,
  webhookToken: string,
): boolean {
  return candidates.some((candidate) => {
    const headers = asRecord(candidate.headers);
    const body = asRecord(candidate.body);
    const event = asRecord(body?.event);
    const type = asString(body?.type)?.toLowerCase();

    return headers?.['x-hubla-token'] === webhookToken
      && (type === 'newsale' || type === 'renewedsale')
      && asString(event?.transactionId) === externalId;
  });
}
