-- Keep a multi-selection permission edit all-or-nothing. Authenticated clients
-- retain read access, while every override write crosses this guarded boundary.

drop policy if exists user_permission_overrides_admin_insert
  on public.user_permission_overrides;
drop policy if exists user_permission_overrides_admin_update
  on public.user_permission_overrides;
drop policy if exists user_permission_overrides_admin_delete
  on public.user_permission_overrides;

revoke all privileges on public.user_permission_overrides from anon, authenticated;
grant select on public.user_permission_overrides to authenticated;

create or replace function public.set_user_permission_overrides(
  p_user_id uuid,
  p_overrides jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  override_item jsonb;
  override_permission_id uuid;
  override_mode text;
  override_count integer;
  distinct_permission_count integer;
  processed_count integer := 0;
begin
  if actor_id is null
    or not exists (
      select 1
      from public.users actor
      where actor.id = actor_id
        and actor.status = 'active'
    )
    or not public.has_permission(actor_id, 'admin.manage_users')
  then
    raise exception using
      errcode = '42501',
      message = 'Not permitted.';
  end if;

  if not exists (select 1 from public.users target where target.id = p_user_id) then
    raise exception using
      errcode = 'P0002',
      message = 'Choose a valid user.';
  end if;

  if p_overrides is null or jsonb_typeof(p_overrides) <> 'array' then
    raise exception using
      errcode = '22023',
      message = 'Permission overrides must be an array.';
  end if;

  override_count := jsonb_array_length(p_overrides);
  if override_count < 1 or override_count > 100 then
    raise exception using
      errcode = '22023',
      message = 'Choose between 1 and 100 permission overrides.';
  end if;

  -- Validate the complete batch before changing any row, so a malformed later
  -- item cannot leave earlier choices applied.
  for override_item in select value from jsonb_array_elements(p_overrides)
  loop
    if jsonb_typeof(override_item) <> 'object'
      or override_item - 'permission_id' - 'mode' <> '{}'::jsonb
      or nullif(override_item ->> 'permission_id', '') is null
      or coalesce(override_item ->> 'mode', '') not in ('grant', 'deny', 'clear')
    then
      raise exception using
        errcode = '22023',
        message = 'Each permission override must contain a permission_id and valid mode.';
    end if;

    begin
      override_permission_id := (override_item ->> 'permission_id')::uuid;
    exception
      when invalid_text_representation then
        raise exception using
          errcode = '22023',
          message = 'Choose a valid permission.';
    end;

    if not exists (
      select 1
      from public.permissions permission
      where permission.id = override_permission_id
    ) then
      raise exception using
        errcode = 'P0002',
        message = 'Choose a valid permission.';
    end if;
  end loop;

  select count(distinct item.value ->> 'permission_id')
  into distinct_permission_count
  from jsonb_array_elements(p_overrides) item;

  if distinct_permission_count <> override_count then
    raise exception using
      errcode = '22023',
      message = 'Each permission can be changed only once per request.';
  end if;

  for override_item in select value from jsonb_array_elements(p_overrides)
  loop
    override_permission_id := (override_item ->> 'permission_id')::uuid;
    override_mode := override_item ->> 'mode';

    if override_mode = 'clear' then
      delete from public.user_permission_overrides
      where user_id = p_user_id
        and permission_id = override_permission_id;
    else
      insert into public.user_permission_overrides (
        user_id,
        permission_id,
        enabled,
        assigned_by
      )
      values (
        p_user_id,
        override_permission_id,
        override_mode = 'grant',
        actor_id
      )
      on conflict (user_id, permission_id) do update
      set enabled = excluded.enabled,
          assigned_by = excluded.assigned_by,
          updated_at = now();
    end if;

    processed_count := processed_count + 1;
  end loop;

  -- Any attempt that would remove the caller's own admin access aborts and
  -- rolls back the complete batch, including a clear of a required grant.
  if p_user_id = actor_id
    and (
      not public.has_permission(actor_id, 'admin.view')
      or not public.has_permission(actor_id, 'admin.manage_users')
    )
  then
    raise exception using
      errcode = '42501',
      message = 'You cannot remove your own admin access.';
  end if;

  return processed_count;
end;
$$;

revoke execute on function public.set_user_permission_overrides(uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.set_user_permission_overrides(uuid, jsonb)
  to authenticated;
