-- As gravações do Ao Vivo eram uma tabela à parte (live_replays) e abriam num
-- modal com só o player. Passam a ser AULAS de um módulo próprio
-- ("Mentoria ao vivo", fora da Home), então abrem na mesma tela de aula que o
-- resto da comunidade: marcar como concluída, anterior/próxima, lista, fórum.
--
-- A tabela live_replays fica no lugar (não é mais lida pelo app).

-- Data em que a live aconteceu — o card do Ao Vivo mostra "24 AGO".
alter table public.lessons add column if not exists recorded_at date;

insert into public.modules
  (slug, title1, title2, title1_es, title2_es, descricao, instructor, duracao, nivel,
   cor_acento, cor_fundo, position, is_published, home_section)
values
  ('aulas-ao-vivo', 'MENTORIA', 'AO VIVO', 'MENTORÍA', 'EN VIVO',
   'Gravações das aulas ao vivo da comunidade.', 'Thaylor Jobs', '', 'Todos os níveis',
   '#BE0D3E', 'from-[#BE0D3E] to-[#E06B85]', 30, true, null)
on conflict (slug) do nothing;

-- As 8 lives já feitas (ordem cronológica = position; a tela mostra da mais
-- recente pra mais antiga). Sem duração nas quatro de 07/09: o YouTube ainda
-- não fechou a gravação, o admin preenche depois.
with m as (select id from public.modules where slug = 'aulas-ao-vivo')
insert into public.lessons (module_id, titulo, duracao, video_url, position, lang, recorded_at)
select m.id, v.titulo, v.duracao, v.video_url, v.position, 'pt', v.recorded_at::date
from m, (values
  ('Como ATRAIR CLIENTES pelo Instagram TODOS OS DIAS (método para profissionais da beleza)', '1h55', 'https://youtube.com/live/q3G8DrEfigM', 1, '2026-08-10'),
  ('STORIES QUE VENDEM: a sequência exata para transformar visualização em cliente',            '1h52', 'https://youtube.com/live/YkGxmbNS3Qw', 2, '2026-08-17'),
  ('DE 200 PARA 100 MIL VIEWS EM 3 DIAS',                                                       '1h08', 'https://youtube.com/live/yBMVxZCXwOQ', 3, '2026-08-24'),
  ('DO ZERO AOS 10K DE FORMA REAL - PLANO SECRETO',                                             '1h09', 'https://youtube.com/live/ISgQkW5u3oo', 4, '2026-08-24'),
  ('TRÁFEGO PAGO PARA ATRAIR CLIENTES: seu primeiro anúncio com R$10/dia (guia completo)',      '',     'https://youtube.com/live/kpVkIYtBT4Y', 5, '2026-09-07'),
  ('AUTOMAÇÃO no WhatsApp E MANYCHAT: agende e venda no automático SEM perder cliente',         '',     'https://youtube.com/live/1DUvsefadvY', 6, '2026-09-07'),
  ('Como CRIAR UM CURSO ONLINE do zero: transforme sua técnica em renda todo mês',              '',     'https://youtube.com/live/ci9ttPSMYWw', 7, '2026-09-07'),
  ('LANÇAMENTO DIGITAL na prática: como fazer sua PRIMEIRA VENDA online do zero',               '',     'https://youtube.com/live/Q-27QVfRCtk', 8, '2026-09-07')
) as v(titulo, duracao, video_url, position, recorded_at)
where not exists (
  select 1 from public.lessons l where l.module_id = m.id and l.video_url = v.video_url
);
