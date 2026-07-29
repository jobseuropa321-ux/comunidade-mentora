# Liberar acesso na mão (painel admin → aba "Acessos")

> **Status: JÁ APLICADO em produção** (migrations `admin_grant_access` e
> `harden_heal_hubla_webhook_grants` + edge function `admin-grant-access`,
> 29/07/2026). Este arquivo é o registro do que existe no banco.

## Pra que serve

Liberar acesso sem passar pela Hubla: bônus, permuta, equipe, suporte a quem
perdeu a senha. A expert digita o e-mail no painel, o sistema gera uma senha
aleatória e devolve na tela — ela copia e manda pra pessoa (nenhum e-mail é
disparado). Se o e-mail já tiver conta, a senha é **redefinida** (a antiga
para de funcionar) e o acesso é renovado.

Dois tipos:

| Tipo | O que faz | Como revogar |
|---|---|---|
| **Aluna** | linha em `subscriptions` (`provider='manual'`, `status='active'`, validade 1 mês / 6 meses / 1 ano / vitalício) | `update subscriptions set status='canceled' where external_id='manual:<email>'` |
| **Expert** | linha em `user_roles` (`role='expert'`) → acesso total **+ painel admin**. Não cria assinatura de propósito: tirar o papel tira o acesso | `delete from user_roles where user_id=... and role='expert'` |

## Segurança — 4 camadas

O frontend (`src/components/admin/AdminAccess.tsx`) é **só um formulário**:
não escreve em `subscriptions`, `user_roles` nem `access_grants`. A RLS dessas
tabelas não tem policy de INSERT/UPDATE pra `authenticated`, então a única
porta é a edge function `admin-grant-access` (service_role):

1. **Gateway** — deploy com `verify_jwt = true`: sem JWT válido a requisição
   nem chega na function.
2. **Sessão** — `getUser()` com a anon key + o `Authorization` do chamador.
   Token forjado, adulterado ou expirado morre aqui.
3. **Papel** — o service_role **reconsulta** `public.user_roles` e exige
   `role='expert'`. A checagem não vem do frontend (o `isExpert` da tela é só
   UX). Aluna logada leva `403 sem_permissao`.
4. **Escrita** — só o service_role escreve. Mesmo com um token de admin roubado
   não dá pra forjar log de auditoria nem pular a function.

Mais: teto de **30 liberações/hora por admin** (429 `limite_atingido`) e trilha
em `public.access_grants` (quem liberou, pra quem, quando, tipo, validade).
**A senha em texto só existe na resposta HTTP** — não é gravada em banco nem
em `console.log`.

Testado em 29/07 com usuários descartáveis: sem header → 401; token de aluna →
403; aluna tentando se promover a expert → 403; token adulterado → 401;
`INSERT` direto em `user_roles`/`subscriptions`/`access_grants` pelo PostgREST →
`42501 violates row-level security`; `rpc/admin_user_id_by_email` por
anon/authenticated → `permission denied`.

## O SQL aplicado

```sql
-- provider 'manual' passa a ser válido em subscriptions
alter table public.subscriptions drop constraint if exists subscriptions_provider_check;
alter table public.subscriptions add constraint subscriptions_provider_check
  check (provider = any (array['hubla'::text, 'cakto'::text, 'manual'::text]));

-- trilha de auditoria (sem FK: o log sobrevive à exclusão da conta)
create table if not exists public.access_grants (
  id               uuid primary key default gen_random_uuid(),
  email            text not null,
  target_user_id   uuid,
  granted_by       uuid not null,
  granted_by_email text,
  access_type      text not null check (access_type in ('aluna', 'expert')),
  action           text not null check (action in ('created', 'password_reset')),
  expires_at       timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists access_grants_created_at_idx on public.access_grants (created_at desc);
create index if not exists access_grants_granted_by_idx on public.access_grants (granted_by, created_at desc);

alter table public.access_grants enable row level security;

-- só expert LÊ; nenhuma policy de escrita (service_role ignora RLS)
create policy "Experts can view access grants"
  on public.access_grants for select to authenticated
  using (public.has_role(auth.uid(), 'expert'));

-- email → user_id sem depender de listUsers() paginado
create or replace function public.admin_user_id_by_email(_email text)
returns uuid language sql stable security definer set search_path to 'public'
as $$ select id from auth.users where lower(email) = lower(trim(_email)) limit 1 $$;

revoke all on function public.admin_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.admin_user_id_by_email(text) to service_role;
```

Na mesma leva, uma brecha antiga fechada (migration
`harden_heal_hubla_webhook_grants`): `heal_hubla_webhook()` era executável por
`anon` via `/rest/v1/rpc/heal_hubla_webhook` — qualquer um na internet podia
disparar os replays em loop. Agora só o pg_cron (roda como `postgres`) chama.

```sql
revoke all on function public.heal_hubla_webhook() from public, anon, authenticated;
```

## Auditoria

```sql
-- Quem liberou o quê
select created_at, granted_by_email, email, access_type, action, expires_at
from access_grants order by created_at desc limit 50;

-- Acessos manuais ativos e suas validades
select email, expires_at, status from subscriptions
where provider = 'manual' order by created_at desc;

-- Quem tem painel de administração hoje
select u.email, r.role from user_roles r join auth.users u on u.id = r.user_id
where r.role = 'expert';
```

## Se precisar redeployar a function

```
supabase functions deploy admin-grant-access   # verify_jwt fica true (default)
```

Secrets: nenhuma nova — usa `SUPABASE_URL`, `SUPABASE_ANON_KEY` e
`SUPABASE_SERVICE_ROLE_KEY` (injetados automático) e opcionalmente
`ALLOWED_ORIGIN`, o mesmo do `chat-viral`.
