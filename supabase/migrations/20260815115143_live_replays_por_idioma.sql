-- As gravações do Ao Vivo eram globais: uma gravação em espanhol apareceria
-- também na versão brasileira. Passam a ter idioma, igual à live em destaque.
alter table public.live_replays add column lang text not null default 'pt';

alter table public.live_replays
  add constraint live_replays_lang_check check (lang in ('pt', 'es'));

create index live_replays_lang_publicado_idx
  on public.live_replays (lang, is_published, position desc);
