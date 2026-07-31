-- Corrige o gate de acesso quando o mesmo email possui mais de uma tentativa
-- de compra. Uma venda ativa e válida sempre vence eventos órfãos mais novos.
create or replace function public.check_email_subscription(check_email text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  latest record;
begin
  -- Compra ativa não vencida ou renovação cancelada ainda dentro do período
  -- pago. CanceledSale não entra aqui: é cancelamento da venda, não da renovação.
  if exists (
    select 1
    from public.subscriptions s
    where lower(btrim(s.email)) = lower(btrim(check_email))
      and (s.expires_at is null or s.expires_at >= now())
      and (
        s.status = 'active'
        or (
          s.status = 'canceled'
          and lower(coalesce(s.raw_payload->>'type', '')) in (
            'canceledsubscription',
            'subscription.renewal_disabled'
          )
        )
      )
  ) then
    return 'active';
  end if;

  select s.status, s.expires_at
  into latest
  from public.subscriptions s
  where lower(btrim(s.email)) = lower(btrim(check_email))
  order by s.updated_at desc nulls last, s.created_at desc
  limit 1;

  if not found then
    return 'not_found';
  end if;

  if latest.status = 'active'
     and latest.expires_at is not null
     and latest.expires_at < now() then
    return 'expired';
  end if;

  return latest.status;
end;
$$;

comment on function public.check_email_subscription(text) is
  'Retorna active quando qualquer entitlement do email estiver válido; cancelamento de renovação mantém acesso até expires_at.';

create index if not exists subscriptions_email_access_idx
  on public.subscriptions (lower(btrim(email)), status, expires_at);

-- CanceledSale com motivo expired/refused e sem pagamento correspondente é
-- uma tentativa de checkout, não uma assinatura. O evento continua auditado
-- em webhook_debug_log, portanto remover a linha derivada não perde histórico.
delete from public.subscriptions s
where lower(coalesce(s.raw_payload->>'type', '')) = 'canceledsale'
  and lower(coalesce(s.raw_payload #>> '{event,reason}', '')) in ('expired', 'refused')
  and nullif(s.raw_payload #>> '{event,paidAt}', '') is null
  and not exists (
    select 1
    from public.webhook_debug_log w
    where lower(coalesce(w.body->>'type', '')) in (
      'newsale',
      'renewedsale',
      'invoice.payment_succeeded'
    )
      and coalesce(
        w.body #>> '{event,transactionId}',
        w.body #>> '{event,invoice,id}'
      ) = s.external_id
  );

-- A versão anterior tratava a simples abertura de um pedido de reembolso como
-- reembolso concluído. Restaura a ativação original quando não existe evento
-- final para a mesma fatura.
with restorations as (
  select
    s.id,
    (
      select w.body
      from public.webhook_debug_log w
      where lower(coalesce(w.body->>'type', '')) in (
        'newsale',
        'renewedsale',
        'invoice.payment_succeeded'
      )
        and coalesce(
          w.body #>> '{event,transactionId}',
          w.body #>> '{event,invoice,id}'
        ) = s.external_id
      order by w.created_at desc
      limit 1
    ) as activation_payload
  from public.subscriptions s
  where lower(coalesce(s.raw_payload->>'type', '')) in (
    'refundrequested',
    'refund_request.created'
  )
    and not exists (
      select 1
      from public.webhook_debug_log w
      where lower(coalesce(w.body->>'type', '')) in (
        'refundedsale',
        'invoice.refunded',
        'refund_request.accepted'
      )
        and coalesce(
          w.body #>> '{event,transactionId}',
          w.body #>> '{event,invoice,id}'
        ) = s.external_id
    )
)
update public.subscriptions s
set status = 'active',
    raw_payload = r.activation_payload,
    updated_at = now()
from restorations r
where s.id = r.id
  and r.activation_payload is not null;

-- No legado, CanceledSale(reason=refunded) representa reembolso efetivo.
update public.subscriptions
set status = 'refunded', updated_at = now()
where lower(coalesce(raw_payload->>'type', '')) = 'canceledsale'
  and lower(coalesce(raw_payload #>> '{event,reason}', '')) = 'refunded'
  and status <> 'refunded';
