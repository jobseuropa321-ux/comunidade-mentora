-- O gate do frontend bloqueia novos logins e revalida a sessão ao abrir o app.
-- Esta função também remove os refresh tokens existentes quando uma compra é
-- cancelada/reembolsada, reduzindo a janela de uma aba que já estava aberta.
create or replace function public.revoke_user_sessions_for_access(_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  delete from auth.sessions
  where user_id = _user_id;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.revoke_user_sessions_for_access(uuid)
  from public, anon, authenticated;
grant execute on function public.revoke_user_sessions_for_access(uuid)
  to service_role;
