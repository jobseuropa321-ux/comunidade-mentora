-- Onboarding de boas-vindas (tela /onboarding, logo no 1º login).
--
-- profiles.onboarding_concluido_em: NULL = ainda não passou pelo onboarding →
-- o app segura a aluna na tela /onboarding até concluir (foto obrigatória).
--
-- As respostas (profissão, tempo, objetivo, expectativa) ficam numa tabela à
-- parte de propósito: `profiles` é legível por qualquer aluna logada
-- (policy profiles_read_all_authenticated), e expectativa é conversa pessoal.

alter table public.profiles
  add column if not exists onboarding_concluido_em timestamptz;

-- Quem já entrou no app antes do onboarding existir não é "primeiro login":
-- marca como concluído. Quem nunca logou (conta criada pela compra e ainda
-- não acessada) passa pelo onboarding no primeiro acesso.
update public.profiles p
   set onboarding_concluido_em = now()
  from auth.users u
 where u.id = p.user_id
   and u.last_sign_in_at is not null
   and p.onboarding_concluido_em is null;

create table if not exists public.onboarding_respostas (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  profissao   text,
  tempo_area  text,
  objetivo    text,
  expectativa text,
  idioma      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.onboarding_respostas enable row level security;

create policy onboarding_select_own on public.onboarding_respostas
  for select to authenticated using (user_id = auth.uid());
create policy onboarding_insert_own on public.onboarding_respostas
  for insert to authenticated with check (user_id = auth.uid());
create policy onboarding_update_own on public.onboarding_respostas
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy onboarding_select_expert on public.onboarding_respostas
  for select to authenticated using (public.has_role(auth.uid(), 'expert'::app_role));
