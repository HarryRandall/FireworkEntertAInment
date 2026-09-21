begin;

do $$
declare
  function_row record;
  function_source text;
begin
  if has_table_privilege('authenticated', 'public.assortment_public_links', 'update') then
    raise exception 'Authenticated callers received table-level QR link UPDATE access.';
  end if;

  if has_function_privilege(
    'anon',
    'public.set_assortment_public_link_enabled(uuid,boolean)',
    'execute'
  )
  or not has_function_privilege(
    'authenticated',
    'public.set_assortment_public_link_enabled(uuid,boolean)',
    'execute'
  ) then
    raise exception 'QR link enablement RPC grants are not least-privilege.';
  end if;

  select pg_get_functiondef(
    'public.set_assortment_public_link_enabled(uuid,boolean)'::regprocedure
  ) into function_source;
  function_source := lower(function_source);
  if function_source not like '%set is_enabled = p_enabled%'
    or function_source like '%set public_token%'
    or function_source like '%set funding_user_id%'
  then
    raise exception 'QR link enablement RPC does not have the expected narrow security boundary.';
  end if;

  if has_table_privilege('anon', 'public.assortment_public_links', 'select')
    or has_table_privilege('anon', 'public.assortment_public_links', 'insert')
    or has_table_privilege('anon', 'public.assortment_public_links', 'update')
  then
    raise exception 'Anonymous callers can access protected assortment capability material.';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'assortments'
      and column_name = 'public_token'
  ) then
    raise exception 'Capability material was added to the anon-readable assortments table.';
  end if;

  if not exists (
    select 1
    from pg_class table_row
    join pg_namespace schema_row on schema_row.oid = table_row.relnamespace
    where schema_row.nspname = 'public'
      and table_row.relname = 'assortment_public_links'
      and table_row.relrowsecurity
  ) then
    raise exception 'assortment_public_links does not have RLS enabled.';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'assortment_public_links'
      and ('anon' = any(roles) or 'public' = any(roles))
  ) then
    raise exception 'A public policy exposes assortment capability material.';
  end if;

  for function_row in
    select oid, prosecdef, coalesce(proconfig, '{}'::text[]) as proconfig
    from pg_proc
    where oid in (
      'public.ensure_assortment_public_link(uuid)'::regprocedure,
      'public.set_assortment_public_link_enabled(uuid,boolean)'::regprocedure,
      'public.prepare_assortment_song_analysis(text,uuid,uuid)'::regprocedure,
      'public.create_assortment_qr_show(text,uuid,text,text,text,text,text,jsonb,uuid)'::regprocedure,
      'public.replace_show_timeline_items(uuid,uuid,jsonb)'::regprocedure
    )
  loop
    if not function_row.prosecdef
      or not function_row.proconfig @> array['search_path=""']
    then
      raise exception 'QR RPC % lost SECURITY DEFINER or its empty search path.', function_row.oid;
    end if;
  end loop;

  if has_function_privilege(
    'anon',
    'public.create_assortment_qr_show(text,uuid,text,text,text,text,text,jsonb,uuid)',
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'public.create_assortment_qr_show(text,uuid,text,text,text,text,text,jsonb,uuid)',
    'execute'
  ) or not has_function_privilege(
    'service_role',
    'public.create_assortment_qr_show(text,uuid,text,text,text,text,text,jsonb,uuid)',
    'execute'
  ) then
    raise exception 'create_assortment_qr_show has unexpected role grants.';
  end if;

  select pg_get_functiondef('public.replace_show_timeline_items(uuid,uuid,jsonb)'::regprocedure)
  into function_source;
  if function_source not like '%<> snapshot.quantity%'
    or function_source not like '%catalogue_item_id is null%'
  then
    raise exception 'Timeline persistence no longer enforces exact snapshot quantities.';
  end if;

  select pg_get_functiondef(
    'private.reserve_assortment_ai_credit(uuid,text,text,uuid,text,jsonb)'::regprocedure
  ) into function_source;
  if function_source not like '%private.ensure_ai_credit_account(p_user_id)%'
    or function_source not like '%private.ai_credit_usage_payload(p_user_id)%'
    or function_source like '%public.ensure_ai_credit_account(p_user_id)%'
    or function_source like '%public.ai_credit_usage_payload(p_user_id)%'
  then
    raise exception 'QR credit reservations no longer use the private credit helpers.';
  end if;
end;
$$;

do $$
declare
  admin_id uuid := '92000000-0000-0000-0000-000000000101';
  member_id uuid := '92000000-0000-0000-0000-000000000102';
  target_assortment_id uuid := '92000000-0000-0000-0000-000000000201';
  original_token text;
  original_funder uuid;
  enabled_value boolean;
  denied boolean := false;
begin
  insert into auth.users (id, email, email_confirmed_at)
  values
    (admin_id, 'assortment-admin@example.test', now()),
    (member_id, 'assortment-member@example.test', now());

  insert into public.user_roles (user_id, role_id)
  select admin_id, roles.id
  from public.roles roles
  where roles.key = 'admin'
  on conflict (user_id) do update
  set role_id = excluded.role_id;

  insert into public.assortments (id, slug, name, price_cents, is_active, created_by)
  values (target_assortment_id, 'qr-toggle-security', 'QR toggle security', 100, true, admin_id);

  set local role authenticated;
  set local request.jwt.claim.role = 'authenticated';
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform public.ensure_assortment_public_link(target_assortment_id);

  select link.public_token, link.funding_user_id
  into original_token, original_funder
  from public.assortment_public_links link
  where link.assortment_id = target_assortment_id;

  perform set_config('request.jwt.claim.sub', member_id::text, true);
  begin
    perform public.set_assortment_public_link_enabled(target_assortment_id, false);
  exception
    when insufficient_privilege then denied := true;
  end;
  if not denied then
    raise exception 'Unauthorised authenticated caller toggled a QR link.';
  end if;

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  enabled_value := public.set_assortment_public_link_enabled(target_assortment_id, false);
  if enabled_value is distinct from false then
    raise exception 'Admin disable did not return false.';
  end if;
  if exists (
    select 1
    from public.assortment_public_links link
    where link.assortment_id = target_assortment_id
      and (link.public_token is distinct from original_token
        or link.funding_user_id is distinct from original_funder)
  ) then
    raise exception 'Disabling changed QR capability or funding ownership.';
  end if;

  enabled_value := public.set_assortment_public_link_enabled(target_assortment_id, true);
  if enabled_value is distinct from true then
    raise exception 'Admin re-enable did not return true.';
  end if;
  if not exists (
    select 1
    from public.assortment_public_links link
    where link.assortment_id = target_assortment_id
      and link.is_enabled
      and link.public_token = original_token
      and link.funding_user_id = original_funder
  ) then
    raise exception 'Re-enabling did not preserve the original QR capability.';
  end if;

  reset role;
end;
$$;

rollback;
