begin;

create temporary table engagement_test_results (
  label text primary key,
  payload jsonb,
  sqlstate text,
  affected_rows bigint
);

grant select, insert, update on table pg_temp.engagement_test_results to authenticated;

create function pg_temp.update_own_profile(p_user_id uuid, p_full_name text)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_affected_rows bigint;
begin
  update public.users
  set full_name = p_full_name
  where id = p_user_id;

  get diagnostics v_affected_rows = row_count;
  return v_affected_rows;
end;
$$;

create function pg_temp.try_insert_media_asset(p_owner_id uuid, p_storage_path text)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.media_assets (owner_id, source_type, storage_path)
  values (p_owner_id, 'upload', p_storage_path);
  return null;
exception
  when others then
    return sqlstate;
end;
$$;

grant execute on function pg_temp.update_own_profile(uuid, text) to authenticated;
grant execute on function pg_temp.try_insert_media_asset(uuid, text) to authenticated;

-- Fixed test identities keep every assertion deterministic and are rolled back.
delete from auth.users
where id in (
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000002',
  '91000000-0000-4000-8000-000000000003',
  '91000000-0000-4000-8000-000000000004'
);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '91000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'active-owner-engagement@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '91000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'suspended-owner-engagement@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '91000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'active-admin-engagement@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '91000000-0000-4000-8000-000000000004',
    'authenticated',
    'authenticated',
    'suspended-admin-engagement@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

update public.users
set
  full_name = case id
    when '91000000-0000-4000-8000-000000000001' then 'Active owner'
    when '91000000-0000-4000-8000-000000000002' then 'Suspended owner'
    when '91000000-0000-4000-8000-000000000003' then 'Active admin'
    else 'Suspended admin'
  end,
  status = case
    when id in (
      '91000000-0000-4000-8000-000000000002',
      '91000000-0000-4000-8000-000000000004'
    ) then 'suspended'
    else 'active'
  end
where id in (
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000002',
  '91000000-0000-4000-8000-000000000003',
  '91000000-0000-4000-8000-000000000004'
);

insert into public.roles (id, key, name, description)
values (
  '92000000-0000-4000-8000-000000000001',
  'active-engagement-test-admin',
  'Active engagement test admin',
  'Transaction-scoped role for suspension boundary tests.'
)
on conflict (key) do nothing;

insert into public.permissions (id, key, name, category)
values
  (
    '93000000-0000-4000-8000-000000000001',
    'admin.manage_imports',
    'Manage imports',
    'admin'
  ),
  (
    '93000000-0000-4000-8000-000000000002',
    'admin.manage_billing',
    'Manage billing',
    'admin'
  )
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select test_role.id, permission.id
from public.roles test_role
join public.permissions permission
  on permission.key in ('admin.manage_imports', 'admin.manage_billing')
where test_role.key = 'active-engagement-test-admin'
on conflict (role_id, permission_id) do nothing;

insert into public.user_roles (user_id, role_id)
select test_user.user_id, test_role.id
from (
  values
    ('91000000-0000-4000-8000-000000000003'::uuid),
    ('91000000-0000-4000-8000-000000000004'::uuid)
) as test_user(user_id)
cross join public.roles test_role
where test_role.key = 'active-engagement-test-admin'
on conflict (user_id) do update
set role_id = excluded.role_id;

insert into public.catalogue_items (
  id,
  part_number,
  name,
  catalogue_item_kind,
  duration_seconds,
  is_listed
)
values (
  '95000000-0000-4000-8000-000000000001',
  'ACTIVE-ENGAGEMENT-TEST',
  'Active engagement test item',
  'other',
  1.5,
  true
);

insert into public.show_presets (
  id,
  slug,
  title,
  theme,
  duration_seconds,
  preview_cues,
  is_published,
  published_at
)
values (
  '96000000-0000-4000-8000-000000000001',
  'active-engagement-test',
  'Active engagement test',
  'Test',
  3,
  jsonb_build_array(
    jsonb_build_object(
      'catalogueItemId', '95000000-0000-4000-8000-000000000001',
      'catalogueItemSlug', 'ACTIVE-ENGAGEMENT-TEST',
      'description', 'Transaction-scoped engagement cue',
      'emphasis', 'normal',
      'timeSeconds', 0,
      'launchPositionIndex', 0
    )
  ),
  true,
  now()
);

delete from public.ai_credit_transactions
where user_id in (
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000002',
  '91000000-0000-4000-8000-000000000003',
  '91000000-0000-4000-8000-000000000004'
);
delete from public.ai_credit_accounts
where user_id in (
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000002',
  '91000000-0000-4000-8000-000000000003',
  '91000000-0000-4000-8000-000000000004'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '91000000-0000-4000-8000-000000000001',
  true
);
insert into pg_temp.engagement_test_results (label, affected_rows)
values (
  'active-profile-update',
  pg_temp.update_own_profile(
    '91000000-0000-4000-8000-000000000001',
    'Active owner updated'
  )
);
insert into pg_temp.engagement_test_results (label, payload)
values
  (
    'active-like',
    public.toggle_show_preset_like('96000000-0000-4000-8000-000000000001')
  ),
  (
    'active-credit-bootstrap',
    public.ensure_ai_credit_account('91000000-0000-4000-8000-000000000001')
  );
insert into pg_temp.engagement_test_results (label, sqlstate)
values (
  'active-owner-media',
  pg_temp.try_insert_media_asset(
    '91000000-0000-4000-8000-000000000001',
    'active-engagement/active-owner.mp4'
  )
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '91000000-0000-4000-8000-000000000002',
  true
);
insert into pg_temp.engagement_test_results (label, affected_rows)
values (
  'suspended-profile-update',
  pg_temp.update_own_profile(
    '91000000-0000-4000-8000-000000000002',
    'Suspended owner updated'
  )
);
insert into pg_temp.engagement_test_results (label, payload)
values
  (
    'suspended-like',
    public.toggle_show_preset_like('96000000-0000-4000-8000-000000000001')
  ),
  (
    'suspended-credit-bootstrap',
    public.ensure_ai_credit_account('91000000-0000-4000-8000-000000000002')
  );
insert into pg_temp.engagement_test_results (label, sqlstate)
values (
  'suspended-owner-media',
  pg_temp.try_insert_media_asset(
    '91000000-0000-4000-8000-000000000002',
    'active-engagement/suspended-owner.mp4'
  )
);
reset role;

do $$
begin
  if exists (
    select 1
    from public.ai_credit_accounts
    where user_id = '91000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'Suspended owner created an AI credit account.';
  end if;
end;
$$;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '91000000-0000-4000-8000-000000000003',
  true
);
insert into pg_temp.engagement_test_results (label, payload)
values (
  'active-admin-credit-bootstrap',
  public.ensure_ai_credit_account('91000000-0000-4000-8000-000000000002')
);
insert into pg_temp.engagement_test_results (label, sqlstate)
values (
  'active-import-admin-media',
  pg_temp.try_insert_media_asset(
    '91000000-0000-4000-8000-000000000002',
    'active-engagement/active-admin.mp4'
  )
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '91000000-0000-4000-8000-000000000004',
  true
);
insert into pg_temp.engagement_test_results (label, payload)
values (
  'suspended-admin-credit-bootstrap',
  public.ensure_ai_credit_account('91000000-0000-4000-8000-000000000001')
);
insert into pg_temp.engagement_test_results (label, sqlstate)
values (
  'suspended-import-admin-media',
  pg_temp.try_insert_media_asset(
    '91000000-0000-4000-8000-000000000001',
    'active-engagement/suspended-admin.mp4'
  )
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '91000000-0000-4000-8000-000000000001',
  true
);
insert into pg_temp.engagement_test_results (label, payload)
values (
  'active-unlike',
  public.toggle_show_preset_like('96000000-0000-4000-8000-000000000001')
);
reset role;

set local role service_role;
insert into public.media_assets (owner_id, source_type, storage_path)
values (
  '91000000-0000-4000-8000-000000000002',
  'upload',
  'active-engagement/service-role.mp4'
);
reset role;

do $$
declare
  v_payload jsonb;
  v_sqlstate text;
  v_affected_rows bigint;
begin
  select affected_rows into v_affected_rows
  from pg_temp.engagement_test_results
  where label = 'active-profile-update';
  if v_affected_rows <> 1 then
    raise exception 'Active owner profile update affected % rows.', v_affected_rows;
  end if;

  select affected_rows into v_affected_rows
  from pg_temp.engagement_test_results
  where label = 'suspended-profile-update';
  if v_affected_rows <> 0 then
    raise exception 'Suspended owner profile update affected % rows.', v_affected_rows;
  end if;

  if (
    select full_name
    from public.users
    where id = '91000000-0000-4000-8000-000000000002'
  ) <> 'Suspended owner' then
    raise exception 'Suspended owner profile was changed.';
  end if;

  select payload into v_payload
  from pg_temp.engagement_test_results
  where label = 'active-like';
  if v_payload->>'ok' <> 'true'
    or v_payload->>'liked' <> 'true'
    or (v_payload->>'likeCount')::integer <> 1 then
    raise exception 'Active like returned an unexpected payload: %', v_payload;
  end if;

  select payload into v_payload
  from pg_temp.engagement_test_results
  where label = 'suspended-like';
  if v_payload <> jsonb_build_object('ok', false, 'error', 'Not permitted.') then
    raise exception 'Suspended like returned an unexpected payload: %', v_payload;
  end if;

  select payload into v_payload
  from pg_temp.engagement_test_results
  where label = 'active-unlike';
  if v_payload->>'ok' <> 'true'
    or v_payload->>'liked' <> 'false'
    or (v_payload->>'likeCount')::integer <> 0 then
    raise exception 'Active unlike returned an unexpected payload: %', v_payload;
  end if;

  if exists (
    select 1
    from public.show_preset_likes
    where show_preset_id = '96000000-0000-4000-8000-000000000001'
      and user_id <> '91000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Suspended caller changed show preset likes.';
  end if;

  for v_payload in
    select payload
    from pg_temp.engagement_test_results
    where label in ('active-credit-bootstrap', 'active-admin-credit-bootstrap')
  loop
    if v_payload->>'ok' <> 'true' then
      raise exception 'Permitted credit bootstrap failed: %', v_payload;
    end if;
  end loop;

  for v_payload in
    select payload
    from pg_temp.engagement_test_results
    where label in ('suspended-credit-bootstrap', 'suspended-admin-credit-bootstrap')
  loop
    if v_payload <> jsonb_build_object('ok', false, 'error', 'Not permitted.') then
      raise exception 'Suspended credit bootstrap returned an unexpected payload: %', v_payload;
    end if;
  end loop;

  if (
    select count(*)
    from public.ai_credit_accounts
    where user_id in (
      '91000000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000002'
    )
  ) <> 2 then
    raise exception 'Permitted credit account bootstrap did not create both accounts.';
  end if;

  for v_sqlstate in
    select sqlstate
    from pg_temp.engagement_test_results
    where label in ('active-owner-media', 'active-import-admin-media')
  loop
    if v_sqlstate is not null then
      raise exception 'Permitted media insert failed with SQLSTATE %.', v_sqlstate;
    end if;
  end loop;

  for v_sqlstate in
    select sqlstate
    from pg_temp.engagement_test_results
    where label in ('suspended-owner-media', 'suspended-import-admin-media')
  loop
    if v_sqlstate <> '42501' then
      raise exception 'Suspended media insert returned SQLSTATE %.', v_sqlstate;
    end if;
  end loop;

  if (
    select count(*)
    from public.media_assets
    where storage_path like 'active-engagement/%'
  ) <> 3 then
    raise exception 'Media insert boundary produced an unexpected row count.';
  end if;
end;
$$;

do $$
declare
  v_policy record;
  v_function record;
begin
  select * into v_policy
  from pg_policies
  where schemaname = 'public'
    and tablename = 'users'
    and policyname = 'users_insert_own';
  if not found or v_policy.with_check not like '%current_user_is_active%' then
    raise exception 'users_insert_own does not require an active user.';
  end if;

  select * into v_policy
  from pg_policies
  where schemaname = 'public'
    and tablename = 'users'
    and policyname = 'users_update_own';
  if not found
    or v_policy.qual not like '%current_user_is_active%'
    or v_policy.with_check not like '%current_user_is_active%' then
    raise exception 'users_update_own does not guard USING and WITH CHECK.';
  end if;

  select * into v_policy
  from pg_policies
  where schemaname = 'public'
    and tablename = 'show_preset_likes'
    and policyname = 'show_preset_likes_insert_own';
  if not found or v_policy.with_check not like '%current_user_is_active%' then
    raise exception 'show_preset_likes_insert_own does not require an active user.';
  end if;

  select * into v_policy
  from pg_policies
  where schemaname = 'public'
    and tablename = 'show_preset_likes'
    and policyname = 'show_preset_likes_delete_own';
  if not found or v_policy.qual not like '%current_user_is_active%' then
    raise exception 'show_preset_likes_delete_own does not require an active user.';
  end if;

  select * into v_policy
  from pg_policies
  where schemaname = 'public'
    and tablename = 'media_assets'
    and policyname = 'media_assets_insert_allowed';
  if not found
    or v_policy.with_check not like '%current_user_is_active%'
    or v_policy.with_check not like '%admin.manage_imports%' then
    raise exception 'media_assets_insert_allowed lost an active or admin branch.';
  end if;

  for v_function in
    select prosecdef, coalesce(proconfig, '{}'::text[]) as proconfig
    from pg_proc
    where oid in (
      'public.ensure_ai_credit_account(uuid)'::regprocedure,
      'public.toggle_show_preset_like(uuid)'::regprocedure
    )
  loop
    if not v_function.prosecdef
      or not v_function.proconfig @> array['search_path=""'] then
      raise exception 'Engagement RPC lost SECURITY DEFINER or its empty search path.';
    end if;
  end loop;

  if has_function_privilege(
    'anon',
    'public.ensure_ai_credit_account(uuid)',
    'execute'
  ) or not has_function_privilege(
    'authenticated',
    'public.ensure_ai_credit_account(uuid)',
    'execute'
  ) or not has_function_privilege(
    'service_role',
    'public.ensure_ai_credit_account(uuid)',
    'execute'
  ) then
    raise exception 'ensure_ai_credit_account has unexpected role grants.';
  end if;

  if has_function_privilege(
    'anon',
    'public.toggle_show_preset_like(uuid)',
    'execute'
  ) or not has_function_privilege(
    'authenticated',
    'public.toggle_show_preset_like(uuid)',
    'execute'
  ) or has_function_privilege(
    'service_role',
    'public.toggle_show_preset_like(uuid)',
    'execute'
  ) then
    raise exception 'toggle_show_preset_like has unexpected role grants.';
  end if;

  if exists (
    select 1
    from information_schema.routine_privileges
    where specific_schema = 'public'
      and routine_name in ('ensure_ai_credit_account', 'toggle_show_preset_like')
      and grantee = 'PUBLIC'
      and privilege_type = 'EXECUTE'
  ) then
    raise exception 'An engagement RPC remains executable by PUBLIC.';
  end if;
end;
$$;

rollback;
