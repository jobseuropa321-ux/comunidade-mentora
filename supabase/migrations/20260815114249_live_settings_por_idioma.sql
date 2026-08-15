-- A live em destaque era um singleton (live_settings id=1) compartilhado pelos
-- dois idiomas: a live em espanhol aparecia como "ao vivo agora" também para a
-- aluna brasileira. Agora é uma linha por idioma.
alter table public.live_settings drop constraint live_settings_single_row;

alter table public.live_settings add column lang text not null default 'pt';

alter table public.live_settings
  add constraint live_settings_lang_check check (lang in ('pt', 'es'));
alter table public.live_settings
  add constraint live_settings_lang_key unique (lang);
alter table public.live_settings
  add constraint live_settings_um_por_idioma check (id in (1, 2));

-- O que estava no ar era conteúdo em espanhol: passa para a linha do 'es'.
insert into public.live_settings (id, lang, is_active, stream_url, title, description, presenter, updated_by, updated_at)
select 2, 'es', is_active, stream_url, title, description, presenter, updated_by, updated_at
from public.live_settings where id = 1;

-- E o português fica sem live ativa, em vez de herdar a transmissão espanhola.
update public.live_settings
set is_active = false, stream_url = null, title = null, description = null, presenter = null
where id = 1;
