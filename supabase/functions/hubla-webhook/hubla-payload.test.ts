import {
  hasAuthenticatedLegacyTwin,
  mapActionFromType,
  mapStatusFromType,
  parseHublaPayload,
  type HublaParseResult,
} from './hubla-payload.ts';

function assertEquals<T>(actual: T, expected: T): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`Esperado ${expectedJson}, recebido ${actualJson}`);
  }
}

function eventFrom(result: HublaParseResult) {
  if (result.kind !== 'event') {
    throw new Error(`Esperava evento processável, recebeu ${result.kind}`);
  }
  return result.event;
}

Deno.test('normaliza uma venda no formato legado', () => {
  const event = eventFrom(parseHublaPayload({
    type: 'NewSale',
    version: '1.0.0',
    event: {
      userName: 'Aluna Teste',
      userEmail: '  ALUNA@EXAMPLE.COM ',
      transactionId: 'invoice-1',
      recurring: 'one_time_purchased',
      paidAt: '2026-07-29T10:00:00.000Z',
      expiresAt: '2026-07-29T11:00:00.000Z',
    },
  }));

  assertEquals(event, {
    eventType: 'NewSale',
    format: 'legacy',
    action: 'activate',
    status: 'active',
    email: 'aluna@example.com',
    userName: 'Aluna Teste',
    externalId: 'invoice-1',
    planType: 'annual',
    paidAt: '2026-07-29T10:00:00.000Z',
    createdAt: null,
    expiresAt: '2026-07-29T11:00:00.000Z',
  });
});

Deno.test('normaliza pagamento no formato v2', () => {
  const event = eventFrom(parseHublaPayload({
    type: 'invoice.payment_succeeded',
    version: '2.0.0',
    event: {
      user: {
        firstName: 'Aluna',
        lastName: 'Teste',
        email: 'aluna@example.com',
      },
      invoice: {
        id: 'invoice-2',
        saleDate: '2026-07-30T12:18:55.050Z',
        dueDate: '2026-08-05T02:17:00.000Z',
      },
      subscriptions: [{ type: 'one_time', billingCycleMonths: 1 }],
    },
  }));

  assertEquals(event, {
    eventType: 'invoice.payment_succeeded',
    format: 'v2',
    action: 'activate',
    status: 'active',
    email: 'aluna@example.com',
    userName: 'Aluna Teste',
    externalId: 'invoice-2',
    planType: 'annual',
    paidAt: '2026-07-30T12:18:55.050Z',
    createdAt: null,
    expiresAt: null,
  });
});

Deno.test('pedido de reembolso ainda não remove acesso', () => {
  assertEquals(parseHublaPayload({
    type: 'refund_request.created',
    version: '2.0.0',
    event: {},
  }), {
    kind: 'ignored',
    eventType: 'refund_request.created',
  });
});

Deno.test('normaliza reembolso aceito usando a fatura original', () => {
  const event = eventFrom(parseHublaPayload({
    type: 'refund_request.accepted',
    version: '2.0.0',
    event: {
      user: { firstName: 'Aluna', email: 'aluna@example.com' },
      invoice: { id: 'invoice-3', saleDate: '2026-07-28T12:05:49.994Z' },
      refund: { id: 'refund-1', status: 'accepted' },
      subscriptions: [{ id: 'subscription-3', type: 'one_time' }],
    },
  }));

  assertEquals(event.action, 'refund');
  assertEquals(event.status, 'refunded');
  assertEquals(event.email, 'aluna@example.com');
  assertEquals(event.externalId, 'invoice-3');
  assertEquals(event.planType, 'annual');
});

Deno.test('separa cancelamento da renovação, desativação e reembolso', () => {
  assertEquals(mapActionFromType('CanceledSubscription'), 'cancel_renewal');
  assertEquals(mapActionFromType('subscription.renewal_disabled'), 'cancel_renewal');
  assertEquals(mapActionFromType('subscription.deactivated'), 'deactivate');
  assertEquals(mapStatusFromType('CanceledSale'), 'canceled');
  assertEquals(mapStatusFromType('RefundRequested'), null);
  assertEquals(mapStatusFromType('refund_request.created'), null);
  assertEquals(mapStatusFromType('RefundedSale'), 'refunded');
});

Deno.test('CanceledSale reembolsada é terminal', () => {
  const event = eventFrom(parseHublaPayload({
    type: 'CanceledSale',
    event: {
      userEmail: 'aluna@example.com',
      userName: 'Aluna',
      transactionId: 'invoice-refunded',
      recurring: 'one_time_purchased',
      reason: 'refunded',
    },
  }));

  assertEquals(event.action, 'refund');
  assertEquals(event.status, 'refunded');
});

Deno.test('evento de assinatura usa a última fatura para atualizar a mesma compra', () => {
  const event = eventFrom(parseHublaPayload({
    type: 'subscription.deactivated',
    version: '2.0.0',
    event: {
      user: { email: 'aluna@example.com', firstName: 'Aluna' },
      subscription: {
        id: 'subscription-4',
        type: 'recurring',
        lastInvoice: { id: 'invoice-4', saleDate: '2026-07-01T10:00:00.000Z' },
      },
    },
  }));

  assertEquals(event.action, 'deactivate');
  assertEquals(event.externalId, 'invoice-4');
});

Deno.test('ignora evento informativo mesmo sem email', () => {
  assertEquals(parseHublaPayload({
    type: 'customer.updated',
    event: {},
  }), {
    kind: 'ignored',
    eventType: 'customer.updated',
  });
});

Deno.test('recusa evento de acesso sem identificadores obrigatórios', () => {
  assertEquals(parseHublaPayload({
    type: 'refund_request.accepted',
    event: { user: { email: 'aluna@example.com' } },
  }), {
    kind: 'error',
    message: 'transaction id ausente',
  });
});

Deno.test('só considera duplicata legada quando transação e token coincidem', () => {
  const candidates = [
    {
      headers: { 'x-hubla-token': 'token-valido' },
      body: {
        type: 'NewSale',
        event: { transactionId: 'invoice-1' },
      },
    },
    {
      headers: { 'x-hubla-token': 'token-falso' },
      body: {
        type: 'NewSale',
        event: { transactionId: 'invoice-2' },
      },
    },
  ];

  assertEquals(
    hasAuthenticatedLegacyTwin(candidates, 'invoice-1', 'token-valido'),
    true,
  );
  assertEquals(
    hasAuthenticatedLegacyTwin(candidates, 'invoice-2', 'token-valido'),
    false,
  );
});
