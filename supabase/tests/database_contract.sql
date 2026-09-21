begin;

create function pg_temp.assert_true(value boolean, message text) returns void language plpgsql as $$
begin
  if value is distinct from true then raise exception '%', message; end if;
end $$;

create function pg_temp.reject(statement text, expected_state text) returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate = expected_state then return; end if;
    raise;
  end;
  raise exception 'Expected SQLSTATE % for %', expected_state, statement;
end $$;

grant execute on function pg_temp.assert_true(boolean, text), pg_temp.reject(text, text) to anon, authenticated;

-- Inspect the installed schema and effective privileges, including inherited/default grants.
select pg_temp.assert_true(not exists (
  select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
), 'Every public table must enable RLS');
select pg_temp.assert_true(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and (has_function_privilege('anon', p.oid, 'EXECUTE')
      or has_function_privilege('authenticated', p.oid, 'EXECUTE'))
), 'Private functions must not be executable by API callers');
select pg_temp.assert_true(not has_schema_privilege('anon', 'private', 'USAGE')
  and not has_schema_privilege('authenticated', 'private', 'USAGE'), 'Private schema must remain inaccessible');
select pg_temp.assert_true(not has_column_privilege('anon', 'public.show_presets', 'source_show_id', 'SELECT'), 'Explore provenance must remain private');
select pg_temp.assert_true(not has_column_privilege('anon', 'public.supplier_inventory_items', 'supplier_id', 'SELECT'), 'Public prices must not reveal supplier identities');
select pg_temp.assert_true(has_column_privilege('anon', 'public.supplier_inventory_items', 'price_cents', 'SELECT'), 'Anonymous visitors must be able to read public prices');
select pg_temp.assert_true(not has_table_privilege('authenticated', 'public.users', 'UPDATE'), 'Profile updates must be column-limited');
select pg_temp.assert_true(not has_column_privilege('authenticated', 'public.users', 'status', 'UPDATE'), 'Users cannot change their own status');
select pg_temp.assert_true(has_column_privilege('authenticated', 'public.users', 'full_name', 'UPDATE'), 'Self-profile editing must remain available');
select pg_temp.assert_true(not has_table_privilege('authenticated', 'public.prompt_configs', 'UPDATE'), 'Prompt writes require transactional RPCs');
select pg_temp.assert_true(not has_table_privilege('authenticated', 'public.show_timeline_items', 'INSERT'), 'Timeline writes require transactional RPCs');
select pg_temp.assert_true(not has_table_privilege('authenticated', 'public.song_analyses', 'UPDATE'), 'Analysis completion must use fenced RPCs');
select pg_temp.assert_true(not has_table_privilege('anon', 'public.jamendo_response_cache', 'SELECT')
  and not has_table_privilege('authenticated', 'public.jamendo_response_cache', 'SELECT'), 'Jamendo cache is service-only');
select pg_temp.assert_true(not has_table_privilege('authenticated', 'public.backend_dead_letters', 'INSERT'), 'Customers cannot forge backend dead letters');

-- These are the customer RPCs used by the current application. Test effective
-- execution rights rather than matching GRANT text in historical migrations.
do $$
declare name text; fn oid;
begin
  foreach name in array array[
    'claim_cue_generation_attempt', 'complete_cue_generation_attempt', 'current_user_access',
    'discard_unused_song_analysis', 'ensure_ai_credit_account', 'fail_cue_generation_attempt',
    'grant_ai_credits', 'refund_ai_credit_reservation', 'replace_show_timeline_items',
    'reserve_ai_credits', 'schedule_cue_generation_retry', 'settle_ai_credit_reservation',
    'sync_multishot_derived_state', 'toggle_show_preset_like'
  ] loop
    select p.oid into strict fn from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = name;
    if not has_function_privilege('authenticated', fn, 'EXECUTE')
      or has_function_privilege('anon', fn, 'EXECUTE') then
      raise exception 'Unexpected customer RPC execution rights: %', name;
    end if;
  end loop;
  foreach name in array array[
    'seal_firework_import_candidate', 'seal_firework_import_render_validation',
    'complete_firework_import_run', 'list_orphan_audio_objects',
    'expire_exhausted_song_analyses', 'expire_exhausted_cue_generations',
    'resolve_reconciled_show_generation_credit'
  ] loop
    select p.oid into strict fn from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = name;
    if not has_function_privilege('service_role', fn, 'EXECUTE')
      or has_function_privilege('authenticated', fn, 'EXECUTE')
      or has_function_privilege('anon', fn, 'EXECUTE') then
      raise exception 'Unexpected worker-only RPC execution rights: %', name;
    end if;
  end loop;
end $$;

-- A new function must not silently become an anonymous API endpoint.
create function public.database_contract_probe() returns boolean language sql as $$ select true $$;
select pg_temp.assert_true(not has_function_privilege('anon', 'public.database_contract_probe()', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.database_contract_probe()', 'EXECUTE'), 'New functions must default to restricted execution');

select pg_temp.assert_true(not exists (
  select 1 from information_schema.tables where table_schema = 'public'
    and table_name in ('products', 'product_shots', 'firework_variants', 'effect_specs', 'show_templates', 'organisations', 'carts', 'orders')
), 'Retired schema must not return');
select pg_temp.assert_true(not exists (
  select 1 from information_schema.columns where table_schema = 'public'
    and ((table_name = 'firework_effects' and column_name = 'type')
      or (table_name = 'users' and column_name in ('billing_address', 'stripe_customer_id')))
), 'Retired columns must not return');
select pg_temp.assert_true((select count(*) = 4 from storage.buckets where id in ('audio', 'covers', 'firework-previews', 'import-videos')), 'All application buckets are installed');
select pg_temp.assert_true((select bool_and(not public) from storage.buckets where id in ('audio', 'import-videos')), 'User audio and import footage must be private');
select pg_temp.assert_true((select bool_and(public) from storage.buckets where id in ('covers', 'firework-previews')), 'Catalogue imagery must be public');

-- The auth trigger must work for arbitrary recipients without an email-based admin backdoor.
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('92000000-0000-4000-8000-000000000001', 'database-owner@example.test', now(), '{"role":"admin"}'),
  ('92000000-0000-4000-8000-000000000002', 'database-other@example.test', now(), '{}');
select pg_temp.assert_true((select count(*) = 2 from public.users where id::text like '92000000-%'), 'Auth signup creates application profiles');
select pg_temp.assert_true((select count(*) = 2 from public.user_roles ur join public.roles r on r.id = ur.role_id
  where ur.user_id::text like '92000000-%' and r.key = 'user'), 'Signup always assigns the standard role, ignoring editable metadata');
select pg_temp.assert_true((select count(*) = 2 from public.ai_credit_accounts where user_id::text like '92000000-%'), 'Signup provisions credit accounts');
select pg_temp.assert_true((select bool_and(balance = 150 and reserved = 0) from public.ai_credit_accounts where user_id::text like '92000000-%'), 'New accounts receive the advertised 150 starter credits');

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '92000000-0000-4000-8000-000000000001';
select pg_temp.assert_true(public.current_user_is_active(), 'Signed-up account must be active');
select pg_temp.assert_true(not public.current_user_has_permission('admin.manage_users'), 'New accounts must not be administrators');
select pg_temp.assert_true(public.current_user_access()->'roles' = '["user"]'::jsonb, 'Access RPC must report the assigned role');
select pg_temp.reject($q$update public.users set status = 'suspended' where id = auth.uid()$q$, '42501');
select pg_temp.assert_true(public.ai_credit_usage_payload('92000000-0000-4000-8000-000000000002') = '{"ok":false,"error":"Not permitted."}'::jsonb, 'Cross-user credit details must be denied');
select pg_temp.reject($q$select private.ensure_ai_credit_account(auth.uid())$q$, '42501');
select pg_temp.assert_true(not (public.grant_ai_credits(auth.uid(), 1000, 'not allowed', 'unauthorised-test')->>'ok')::boolean, 'Customers must not grant themselves credits');
update public.users set full_name = 'Updated name' where id = auth.uid();
select pg_temp.assert_true((select full_name = 'Updated name' from public.users where id = auth.uid()), 'Allowed profile editing must work');
reset role;

select pg_temp.reject($q$insert into public.shows(user_id, slug, title, status) values ('92000000-0000-4000-8000-000000000001', 'invalid-contract', 'Invalid', 'unknown')$q$, '23514');
select pg_temp.reject($q$insert into public.show_presets(slug, title, is_published, preview_cues) values ('invalid-contract', 'Invalid', true, '[]')$q$, '23514');
select pg_temp.reject($q$update public.multishot_fireworks set time_offset_seconds = -1 where id = (select id from public.multishot_fireworks limit 1)$q$, '23514');

-- RLS filtering must still allow public browse without user identities or private jobs.
set local role anon;
set local request.jwt.claim.role = 'anon';
set local request.jwt.claim.sub = '';
select pg_temp.assert_true((select count(*) > 0 from public.fireworks), 'Anonymous catalogue browsing works');
select pg_temp.assert_true((select count(id) = 3 from public.show_presets), 'Only the selected published example presets are visible');
select pg_temp.reject('select * from public.users', '42501');
select pg_temp.reject('select * from public.import_runs', '42501');
reset role;

rollback;
