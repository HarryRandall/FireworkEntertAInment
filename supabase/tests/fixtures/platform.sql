-- Independent tenant and identity fixtures for platform policy and lifecycle tests.
create or replace function tests.create_platform_fixture()
returns void language plpgsql set search_path = '' as $$
#variable_conflict error
begin
  perform tests.create_personas();
  insert into public.markets(code,name,currency,locale,timezone,min_age,units)
    values ('GB','Fixture','GBP','en-GB','Europe/London',18,'metric'),('AU','Other market','AUD','en-AU','Australia/Sydney',18,'metric');
  insert into public.organisations(id,name,slug,home_market,billing_currency) values
    ('10000000-0000-0000-0000-000000000001','Fixture','platform-one','GB','GBP'),
    ('10000000-0000-0000-0000-000000000002','Other','platform-two','AU','AUD');
  insert into public.staff_roles(profile_id,role) values(tests.get_supabase_uid('platform_staff'),'super_admin');
  insert into public.memberships(organisation_id,profile_id,role) values
    ('10000000-0000-0000-0000-000000000001',tests.get_supabase_uid('organisation_owner'),'owner'),
    ('10000000-0000-0000-0000-000000000001',tests.get_supabase_uid('organisation_manager'),'manager'),
    ('10000000-0000-0000-0000-000000000002',tests.get_supabase_uid('other_organisation_member'),'owner');
  insert into public.integrations(id,organisation_id,provider,status,secret_id) values
    ('87000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','square','connected',gen_random_uuid()),
    ('87000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','square','connected',gen_random_uuid());
  insert into public.sync_runs(organisation_id,integration_id)
    select organisation_id,id from public.integrations;
  insert into public.webhook_endpoints(organisation_id,url,events,secret_id)
    select id,'https://example.invalid/hook',array['list.created'],gen_random_uuid() from public.organisations;
  insert into public.api_keys(organisation_id,prefix,key_hash,scopes)
    select id,'fixture',encode(extensions.digest(id::text,'sha256'),'hex'),array['range.read'] from public.organisations;
  insert into public.feature_flags(key,enabled,rollout_pct) values ('fixture',true,100),('disabled',false,100);
  insert into public.flag_overrides(flag_key,organisation_id,enabled)
    select 'fixture',id,true from public.organisations;
  insert into public.platform_settings(key,value) values('fixture','{}');
  insert into public.notifications(profile_id,organisation_id,kind,title)
    select profile_id,organisation_id,'fixture','Fixture notice' from public.memberships;
  insert into public.notification_preferences(profile_id,organisation_id,kind,channel,enabled)
    select profile_id,organisation_id,'fixture','in_app',true from public.memberships;
  insert into public.support_sessions(staff_id,organisation_id,mode,reason,ends_at)
    values(tests.get_supabase_uid('platform_staff'),'10000000-0000-0000-0000-000000000001','view','Fixture',now()+interval '1 hour');
end;
$$;
comment on function tests.create_platform_fixture() is 'Creates two organisations and the real table-backed platform personas in the test transaction.';
