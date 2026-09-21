-- ShowCrafter baseline: access.
set check_function_bodies = false;

CREATE OR REPLACE FUNCTION "public"."current_user_access"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with current_profile as (
    select id, email, full_name, phone, status, theme_preference
    from public.users
    where id = auth.uid()
  ),
  assigned_roles as (
    select r.id, r.key, r.name
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
  ),
  role_grants as (
    select distinct p.key
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = auth.uid()
  ),
  overrides as (
    select p.key, upo.enabled
    from public.user_permission_overrides upo
    join public.permissions p on p.id = upo.permission_id
    where upo.user_id = auth.uid()
  ),
  final_permissions as (
    select key from role_grants
    where key not in (select key from overrides where enabled = false)
    union
    select key from overrides where enabled = true
  )
  select jsonb_build_object(
    'profile', coalesce((select to_jsonb(current_profile) from current_profile), '{}'::jsonb),
    'roles', coalesce((select jsonb_agg(key order by key) from assigned_roles), '[]'::jsonb),
    'permissions', coalesce((select jsonb_agg(key order by key) from final_permissions), '[]'::jsonb)
  );
$$;

ALTER FUNCTION "public"."current_user_access"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."current_user_has_permission"("permission_key" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1
    from public.users app_user
    where app_user.id = (select auth.uid())
      and app_user.status = 'active'
      and public.has_permission(app_user.id, permission_key)
  );
$$;

ALTER FUNCTION "public"."current_user_has_permission"("permission_key" "text") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."current_user_has_permission"("permission_key" "text") IS 'Returns whether the live authenticated user is active and has the requested effective permission.';

CREATE OR REPLACE FUNCTION "public"."current_user_is_active"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1
    from public.users app_user
    where app_user.id = (select auth.uid())
      and app_user.status = 'active'
  );
$$;

ALTER FUNCTION "public"."current_user_is_active"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  assigned_role_id uuid;
  assigned_role_key text;
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do update
  set email = excluded.email,
      updated_at = now();

  -- Administrator access is granted explicitly after signup during installation.
  assigned_role_key := 'user';

  select id into assigned_role_id
  from public.roles
  where key = assigned_role_key;

  if assigned_role_id is null then
    raise exception 'Required signup role % does not exist.', assigned_role_key;
  end if;

  insert into public.user_roles (user_id, role_id)
  values (new.id, assigned_role_id)
  on conflict (user_id) do update
  set role_id = excluded.role_id;

  return new;
end;
$$;

ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."has_permission"("target_user_id" "uuid", "permission_key" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.user_permission_overrides upo
    join public.permissions p on p.id = upo.permission_id
    where upo.user_id = target_user_id
      and p.key = permission_key
      and upo.enabled = true
  )
  or (
    exists (
      select 1
      from public.user_roles ur
      join public.role_permissions rp on rp.role_id = ur.role_id
      join public.permissions p on p.id = rp.permission_id
      where ur.user_id = target_user_id
        and p.key = permission_key
    )
    and not exists (
      select 1
      from public.user_permission_overrides upo
      join public.permissions p on p.id = upo.permission_id
      where upo.user_id = target_user_id
        and p.key = permission_key
        and upo.enabled = false
    )
  );
$$;

ALTER FUNCTION "public"."has_permission"("target_user_id" "uuid", "permission_key" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_user_permission_overrides"("p_user_id" "uuid", "p_overrides" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "public"."set_user_permission_overrides"("p_user_id" "uuid", "p_overrides" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_user_status"("p_user_id" "uuid", "p_status" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "public"."set_user_status"("p_user_id" "uuid", "p_status" "text") OWNER TO "postgres";
