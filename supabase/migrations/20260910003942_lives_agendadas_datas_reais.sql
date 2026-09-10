-- Das 8 lives cadastradas, 4 ainda vão acontecer (o YouTube marca isUpcoming)
-- e a data delas tinha sido gravada como o dia em que foram agendadas (07/09).
-- Passam a ter a data real da transmissão; a tela Ao Vivo mostra aula com
-- recorded_at no futuro em "Próximas aulas" e só depois do dia em "Gravações".
-- A de 31/08 estava com a data de upload (24/08) em vez da data da live.
update public.lessons set recorded_at = '2026-08-31' where video_url = 'https://youtube.com/live/ISgQkW5u3oo';
update public.lessons set recorded_at = '2026-09-14' where video_url = 'https://youtube.com/live/kpVkIYtBT4Y';
update public.lessons set recorded_at = '2026-09-21' where video_url = 'https://youtube.com/live/1DUvsefadvY';
update public.lessons set recorded_at = '2026-09-28' where video_url = 'https://youtube.com/live/ci9ttPSMYWw';
update public.lessons set recorded_at = '2026-10-05' where video_url = 'https://youtube.com/live/Q-27QVfRCtk';
