-- upload de avatar usa upsert (INSERT ... ON CONFLICT DO UPDATE), que exige
-- policy de SELECT; sem ela TODO upload voltava 400 (RLS). Escopo = própria
-- pasta: exibir a foto não depende disso (bucket público) e evita listagem.
create policy avatars_owner_select on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (auth.uid())::text);
