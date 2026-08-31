begin;

do $$
declare
  function_row record;
  function_source text;
begin
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

rollback;
