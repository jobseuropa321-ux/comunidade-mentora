# hotmart-webhook

Libera acesso das vendas em espanhol feitas na Hotmart. Espelha o
`hubla-webhook`, com e-mail em espanhol e login apontando para `/es/auth`.

## Deploy

```bash
supabase functions deploy hotmart-webhook --no-verify-jwt
```

A flag está versionada em `supabase/config.toml`, mas passe explicitamente se
for deployar por CI. **Sem ela o webhook devolve 401 permanente e as vendas
param de liberar acesso em silêncio.**

## Variáveis de ambiente

| Variável | Obrigatória | O que é |
|---|---|---|
| `HOTMART_WEBHOOK_SECRET` | sim | o hottok, que a Hotmart manda no header `X-HOTMART-HOTTOK` |
| `HOTMART_PRODUCT_IDS` | sim | ids de produto permitidos, separados por vírgula |
| `HOTMART_ANNUAL_PRODUCT_IDS` | não | quais desses ids são plano anual (o resto vira mensal) |
| `RESEND_API_KEY` | sim | envio do e-mail de acesso |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | sim | injetadas pela plataforma |

`HOTMART_PRODUCT_IDS` **vazia rejeita tudo**, de propósito: liberar geral por
engano de configuração é pior do que não liberar ninguém e aparecer no log.

## Configuração na Hotmart

- URL do webhook apontando para esta function
- Versão da API: **2.0.0** (o parser espera tudo dentro de `data`)

## Eventos tratados

| Evento | Status interno |
|---|---|
| `PURCHASE_APPROVED`, `PURCHASE_COMPLETE` | `active` |
| `SUBSCRIPTION_CANCELLATION`, `PURCHASE_CANCELED` | `canceled` |
| `PURCHASE_REFUNDED`, `PURCHASE_CHARGEBACK`, `PURCHASE_PROTEST` | `refunded` |
| `PURCHASE_EXPIRED` | `expired` |

`PURCHASE_DELAYED` **não é tratado de propósito**: no app original ele vira
`expired` e corta o acesso na hora por um atraso de parcela, sem carência.

## Antes do primeiro teste

A migration `20260812020000_subscriptions_allow_hotmart_provider.sql` precisa
estar aplicada. Sem ela o CHECK de `provider` recusa `'hotmart'` e todo insert
falha por violação de constraint.
