-- Smoke coverage for extensions, private capabilities and realistic persona switching.
select no_plan();

select has_extension('pgcrypto');
select has_extension('citext');
select has_extension('pg_jsonschema');
select has_extension('postgis');
select has_extension('pg_cron');
select has_extension('supabase_vault');
select ok(
  not exists (select from pg_catalog.pg_available_extensions where name = 'pg_partman')
  or exists (select from pg_catalog.pg_extension where extname = 'pg_partman'),
  'partition management is installed when the image supports it'
);

select tests.create_personas();

-- This disposable policy proves the harness can distinguish allowed and denied rows.
create table tests.owned_rows (shopper_id uuid primary key);
alter table tests.owned_rows enable row level security;
create policy read_own_row on tests.owned_rows for select to authenticated
  using (shopper_id = (select private.uid()));
grant select on tests.owned_rows to authenticated;
insert into tests.owned_rows select id from auth.users
  where raw_user_meta_data ->> 'test_identifier' in (
    'platform_staff', 'organisation_owner', 'organisation_manager',
    'other_organisation_member', 'anonymous_shopper', 'signed_in_shopper', 'supplier_member'
  );

select tests.act_as('platform_staff');
select is(current_user::text, 'authenticated', 'platform_staff uses the authenticated API role');
select is(private.uid(), tests.get_supabase_uid('platform_staff'), 'platform_staff has its own UUID');
select is(private.is_anon(), false, 'platform_staff has the correct anonymous flag');
select is((select count(*) from tests.owned_rows), 1::bigint, 'platform_staff can read its own row');
select is((select count(*) from tests.owned_rows where shopper_id <> tests.get_supabase_uid('platform_staff')), 0::bigint, 'platform_staff cannot read another user row');
reset role;

select tests.act_as('organisation_owner');
select is(current_user::text, 'authenticated', 'organisation_owner uses the authenticated API role');
select is(private.uid(), tests.get_supabase_uid('organisation_owner'), 'organisation_owner has its own UUID');
select is(private.is_anon(), false, 'organisation_owner has the correct anonymous flag');
select is((select count(*) from tests.owned_rows), 1::bigint, 'organisation_owner can read its own row');
select is((select count(*) from tests.owned_rows where shopper_id <> tests.get_supabase_uid('organisation_owner')), 0::bigint, 'organisation_owner cannot read another user row');
reset role;

select tests.act_as('organisation_manager');
select is(current_user::text, 'authenticated', 'organisation_manager uses the authenticated API role');
select is(private.uid(), tests.get_supabase_uid('organisation_manager'), 'organisation_manager has its own UUID');
select is(private.is_anon(), false, 'organisation_manager has the correct anonymous flag');
select is((select count(*) from tests.owned_rows), 1::bigint, 'organisation_manager can read its own row');
select is((select count(*) from tests.owned_rows where shopper_id <> tests.get_supabase_uid('organisation_manager')), 0::bigint, 'organisation_manager cannot read another user row');
reset role;

select tests.act_as('other_organisation_member');
select is(current_user::text, 'authenticated', 'other_organisation_member uses the authenticated API role');
select is(private.uid(), tests.get_supabase_uid('other_organisation_member'), 'other_organisation_member has its own UUID');
select is(private.is_anon(), false, 'other_organisation_member has the correct anonymous flag');
select is((select count(*) from tests.owned_rows), 1::bigint, 'other_organisation_member can read its own row');
select is((select count(*) from tests.owned_rows where shopper_id <> tests.get_supabase_uid('other_organisation_member')), 0::bigint, 'other_organisation_member cannot read another user row');
reset role;

select tests.act_as('anonymous_shopper');
select is(current_user::text, 'authenticated', 'anonymous_shopper uses the authenticated API role');
select is(private.uid(), tests.get_supabase_uid('anonymous_shopper'), 'anonymous_shopper has its own UUID');
select is(private.is_anon(), true, 'anonymous_shopper has the correct anonymous flag');
select is((select count(*) from tests.owned_rows), 1::bigint, 'anonymous_shopper can read its own row');
select is((select count(*) from tests.owned_rows where shopper_id <> tests.get_supabase_uid('anonymous_shopper')), 0::bigint, 'anonymous_shopper cannot read another user row');
reset role;

select tests.act_as('signed_in_shopper');
select is(current_user::text, 'authenticated', 'signed_in_shopper uses the authenticated API role');
select is(private.uid(), tests.get_supabase_uid('signed_in_shopper'), 'signed_in_shopper has its own UUID');
select is(private.is_anon(), false, 'signed_in_shopper has the correct anonymous flag');
select is((select count(*) from tests.owned_rows), 1::bigint, 'signed_in_shopper can read its own row');
select is((select count(*) from tests.owned_rows where shopper_id <> tests.get_supabase_uid('signed_in_shopper')), 0::bigint, 'signed_in_shopper cannot read another user row');
reset role;

select tests.act_as('supplier_member');
select is(current_user::text, 'authenticated', 'supplier_member uses the authenticated API role');
select is(private.uid(), tests.get_supabase_uid('supplier_member'), 'supplier_member has its own UUID');
select is(private.is_anon(), false, 'supplier_member has the correct anonymous flag');
select is((select count(*) from tests.owned_rows), 1::bigint, 'supplier_member can read its own row');
select is((select count(*) from tests.owned_rows where shopper_id <> tests.get_supabase_uid('supplier_member')), 0::bigint, 'supplier_member cannot read another user row');
reset role;

select tests.act_as_public();
select is(current_user::text, 'anon', 'public requests use the anon API role');
select is(private.uid(), null::uuid, 'clearing authentication removes the previous user');
select is(private.is_anon(), false, 'a public request has no anonymous-user claim');
select throws_ok('select * from tests.owned_rows', '42501', 'permission denied for table owned_rows', 'the public role cannot read the fixture');
reset role;

select ok(not has_schema_privilege('authenticated', 'private', 'CREATE'), 'API users cannot create private helpers');
select ok(not has_function_privilege('authenticated', 'private.set_updated_at()', 'EXECUTE'), 'the trigger helper is not an API capability');
select ok(not has_function_privilege('anon', 'private.set_updated_at()', 'EXECUTE'), 'public requests cannot execute the trigger helper');

-- A sentinel timestamp makes the trigger's overwrite observable within one transaction.
create table tests.timestamps (updated_at timestamptz not null);
create trigger set_updated_at before update on tests.timestamps
  for each row execute function private.set_updated_at();
insert into tests.timestamps values ('2000-01-01T00:00:00Z');
update tests.timestamps set updated_at = '2001-01-01T00:00:00Z';
select is((select updated_at from tests.timestamps), pg_catalog.now(), 'updates use transaction time rather than a supplied timestamp');

create function public.ungranted_helper() returns boolean language sql set search_path = '' as $$ select true; $$;
select ok(not has_function_privilege('anon', 'public.ungranted_helper()', 'EXECUTE'), 'new public functions default to revoked');
select ok(not has_function_privilege('authenticated', 'public.ungranted_helper()', 'EXECUTE'), 'authenticated users need explicit function grants');
select ok(not has_function_privilege('service_role', 'public.ungranted_helper()', 'EXECUTE'), 'service functions also need explicit grants');

select * from finish();
