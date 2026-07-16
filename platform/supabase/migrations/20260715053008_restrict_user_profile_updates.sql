-- Ordinary users may edit only their own presentation preferences. Identity,
-- account status, and audit columns stay outside the direct Data API write path.
revoke update on table public.users from authenticated;
revoke update (id, email, full_name, phone, status, theme_preference, created_at, updated_at)
  on table public.users from authenticated;
grant update (full_name, phone, theme_preference) on table public.users to authenticated;

drop policy if exists users_update_own_or_admin on public.users;
drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Status changes are privileged independently of the caller's table grants.
-- The database rechecks the live account and RBAC state so a stale app cache
-- cannot extend administrative access.
create or replace function public.set_user_status(p_user_id uuid, p_status text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := auth.uid();
  v_updated_user_id uuid;
begin
  if v_caller_id is null
    or not exists (
      select 1
      from public.users caller
      where caller.id = v_caller_id
        and caller.status = 'active'
    )
    or not public.current_user_has_permission('admin.manage_users') then
    raise exception using errcode = '42501', message = 'Not permitted.';
  end if;

  if p_user_id is null or p_status is null or p_status not in ('active', 'suspended') then
    raise exception using errcode = '22023', message = 'Invalid user status request.';
  end if;

  if p_user_id = v_caller_id and p_status = 'suspended' then
    raise exception using errcode = '42501', message = 'You cannot suspend your own account.';
  end if;

  update public.users
  set status = p_status
  where id = p_user_id
  returning id into v_updated_user_id;

  if v_updated_user_id is null then
    raise exception using errcode = 'P0002', message = 'User was not found.';
  end if;

  return v_updated_user_id;
end;
$$;

revoke execute on function public.set_user_status(uuid, text)
  from public, anon, service_role;
grant execute on function public.set_user_status(uuid, text) to authenticated;

-- Fail the migration if role inheritance, a stale column grant, or another
-- permissive UPDATE policy weakens the intended contract.
do $$
declare
  v_column_name text;
begin
  if has_table_privilege('authenticated', 'public.users', 'UPDATE') then
    raise exception 'authenticated retains table-wide UPDATE on public.users';
  end if;

  foreach v_column_name in array array['full_name', 'phone', 'theme_preference'] loop
    if not has_column_privilege(
      'authenticated',
      'public.users',
      v_column_name,
      'UPDATE'
    ) then
      raise exception 'authenticated is missing UPDATE on public.users.%', v_column_name;
    end if;
  end loop;

  foreach v_column_name in array array['id', 'email', 'status', 'created_at', 'updated_at'] loop
    if has_column_privilege('authenticated', 'public.users', v_column_name, 'UPDATE') then
      raise exception 'authenticated retains UPDATE on public.users.%', v_column_name;
    end if;
  end loop;

  if (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and cmd in ('UPDATE', 'ALL')
  ) <> 1 or not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and cmd in ('UPDATE', 'ALL')
      and policyname = 'users_update_own'
  ) then
    raise exception 'public.users must have only the users_update_own UPDATE policy';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.set_user_status(uuid,text)',
    'EXECUTE'
  ) or has_function_privilege('anon', 'public.set_user_status(uuid,text)', 'EXECUTE')
    or has_function_privilege('service_role', 'public.set_user_status(uuid,text)', 'EXECUTE') then
    raise exception 'public.set_user_status has unexpected execution privileges';
  end if;
end;
$$;
