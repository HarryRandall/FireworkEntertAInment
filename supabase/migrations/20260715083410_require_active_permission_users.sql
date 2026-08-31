-- Permission-backed RLS and RPC checks must treat suspension as an immediate
-- database-level revocation, even while an older JWT remains valid.

create or replace function public.current_user_has_permission(permission_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users app_user
    where app_user.id = (select auth.uid())
      and app_user.status = 'active'
      and public.has_permission(app_user.id, permission_key)
  );
$$;

comment on function public.current_user_has_permission(text) is
  'Returns whether the live authenticated user is active and has the requested effective permission.';

revoke execute on function public.current_user_has_permission(text)
  from public, anon, service_role;
grant execute on function public.current_user_has_permission(text)
  to authenticated;
