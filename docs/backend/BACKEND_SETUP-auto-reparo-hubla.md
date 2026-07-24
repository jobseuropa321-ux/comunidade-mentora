# Auto-reparo do webhook da Hubla (pg_cron + pg_net)

> **Status: JÁ APLICADO em produção** (migration `heal_hubla_webhook_autorepair`,
> 24/07/2026). Este arquivo é o registro do que existe no banco.

## Por quê

O Supabase Auth do projeto sofre um erro **intermitente** ao criar contas:
`403 bad_jwt — unrecognized JWT kid ES256` (relacionado à migração de chaves
JWT do Supabase em 2026). A janela ruim pode durar **minutos** (caso real de
24/07: ~4 min), mais do que qualquer retry dentro do webhook aguenta — e a
Hubla não retenta o 500 de forma confiável. Casos reais perdidos assim:
emilly16oliveira55 e anareis2412 (ambos reparados manualmente em 24/07).

## Como funciona

A cada **5 minutos** o job `heal-hubla-webhook` (pg_cron) roda
`public.heal_hubla_webhook()`:

1. Procura no `webhook_debug_log` vendas (`NewSale`/`RenewedSale`) das últimas
   48h, com mais de 3 min de idade, cujo `transactionId` **não existe** em
   `subscriptions` — ou seja, compras que o webhook recebeu mas não processou.
2. Reenvia a requisição **original** (raw_body + x-hubla-token guardados no
   log) pro próprio `hubla-webhook` via `net.http_post`. O upsert por
   `(provider, external_id)` torna o replay idempotente.
3. Registra cada replay no `webhook_debug_log` com provider `hubla-heal`.
   Teto de 36 tentativas por venda (≈3h) evita loop eterno com token inválido.

Defesa em camadas: o webhook em si tenta 3x (esperas 3s/10s) pra janelas
curtas; o cron cobre as janelas longas. Cliente recebe conta + email com no
máximo ~5–8 min de atraso, sem intervenção manual.

## Monitoramento

```sql
-- Replays feitos pelo auto-reparo
select created_at, body->>'email' as email, body->>'tx' as tx
from webhook_debug_log where provider = 'hubla-heal' order by created_at desc;

-- Execuções do job
select * from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'heal-hubla-webhook')
order by start_time desc limit 20;

-- Vendas ainda sem assinatura (deveria estar sempre vazio)
select w.created_at, w.body->'event'->>'userEmail' as email
from webhook_debug_log w
where w.provider = 'hubla' and w.body->>'type' in ('NewSale','RenewedSale')
  and not exists (select 1 from subscriptions s
    where s.provider='hubla' and s.external_id = w.body->'event'->>'transactionId');
```

## Desativar (se um dia precisar)

```sql
select cron.unschedule('heal-hubla-webhook');
```
