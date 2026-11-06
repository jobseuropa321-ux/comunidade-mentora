-- Versão /amanda: variante em português do app com catálogo próprio.
-- 'herda' = aparece na Amanda se aparece no PT (padrão, tudo que já existe)
-- 'so'    = só na Amanda (some do PT e do ES)
-- 'nao'   = fica fora da Amanda (PT/ES como antes)
alter table public.modules
  add column if not exists amanda text not null default 'herda'
  check (amanda in ('herda', 'so', 'nao'));

alter table public.lessons
  add column if not exists amanda text not null default 'herda'
  check (amanda in ('herda', 'so', 'nao'));
