-- Aparelhos que aceitaram receber notificação. Uma linha por navegador/aparelho
-- (a mesma aluna pode ter celular e desktop), identificada pelo endpoint que o
-- push service devolve.
create table public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  -- Idioma em que a aluna estava ao permitir: é por ele que o disparo escolhe
  -- quem recebe, para não mandar texto em português para a versão espanhola.
  lang         text not null default 'pt' check (lang in ('pt', 'es')),
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index push_subscriptions_lang_idx on public.push_subscriptions (lang);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- A aluna cuida só dos aparelhos dela.
create policy push_subscriptions_own_select on public.push_subscriptions
  for select to authenticated using (auth.uid() = user_id);
create policy push_subscriptions_own_insert on public.push_subscriptions
  for insert to authenticated with check (auth.uid() = user_id);
create policy push_subscriptions_own_update on public.push_subscriptions
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy push_subscriptions_own_delete on public.push_subscriptions
  for delete to authenticated using (auth.uid() = user_id);

-- O admin precisa ver quantos aparelhos existem por idioma antes de disparar.
create policy push_subscriptions_expert_select on public.push_subscriptions
  for select to authenticated using (has_role(auth.uid(), 'expert'::app_role));
