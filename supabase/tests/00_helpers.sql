-- Transaction-local identities; domain fixtures assign staff roles and memberships.

-- pgTAP is installed by the CLI after application default execution is revoked.
-- Grant only its assertion functions, inside the disposable test transaction.
do $$
declare
  assertion_function regprocedure;
begin
  for assertion_function in
    select procedure.oid::regprocedure
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_depend as dependency on dependency.objid = procedure.oid
      and dependency.classid = 'pg_catalog.pg_proc'::regclass
      and dependency.refclassid = 'pg_catalog.pg_extension'::regclass
      and dependency.deptype = 'e'
    join pg_catalog.pg_extension as extension on extension.oid = dependency.refobjid
    where extension.extname = 'pgtap'
  loop
    execute pg_catalog.format('grant execute on function %s to anon, authenticated, service_role', assertion_function);
  end loop;
end;
$$;

-- Creates synthetic auth users for every access-control persona and returns no data.
create or replace function tests.create_personas()
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform tests.create_supabase_user('platform_staff');
  perform tests.create_supabase_user('organisation_owner');
  perform tests.create_supabase_user('organisation_manager');
  perform tests.create_supabase_user('other_organisation_member');
  perform tests.create_supabase_user('anonymous_shopper');
  perform tests.create_supabase_user('signed_in_shopper');
  perform tests.create_supabase_user('supplier_member');
  update auth.users set is_anonymous = true
    where id = tests.get_supabase_uid('anonymous_shopper');
end;
$$;

-- Acts as a fixture user, including the server-issued anonymous flag, for this transaction.
create or replace function tests.act_as(persona text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  anonymous_user boolean;
  claims jsonb;
begin
  select is_anonymous into anonymous_user from auth.users
    where id = tests.get_supabase_uid(persona);
  perform tests.authenticate_as(persona);
  claims := pg_catalog.current_setting('request.jwt.claims')::jsonb;
  perform pg_catalog.set_config('request.jwt.claim.sub', '', true);
  perform pg_catalog.set_config('request.jwt.claim.role', '', true);
  perform pg_catalog.set_config('request.jwt.claims',
    (claims || pg_catalog.jsonb_build_object('role', 'authenticated',
      'is_anonymous', coalesce(anonymous_user, false)))::text, true);
end;
$$;

-- Clears fixture identity and legacy claims and switches to the unauthenticated API role.
create or replace function tests.act_as_public()
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform tests.clear_authentication();
  perform pg_catalog.set_config('request.jwt.claim.sub', '', true);
  perform pg_catalog.set_config('request.jwt.claim.role', '', true);
end;
$$;
