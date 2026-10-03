-- Two-organisation financial and analytics facts, created inside each rollback-only suite.
create function tests.create_operations_fixture()
returns void language plpgsql set search_path = '' as $$
#variable_conflict error
begin
  perform tests.create_shoppers_fixture();
  insert into public.plans(key,name,monthly_credits,active) values ('active','Fixture plan',10,true),('inactive','Retired fixture plan',0,false);
  insert into public.credit_packs(key,credits,active) values ('active',10,true),('inactive',10,false);
  insert into public.credit_prices(action,credits) values ('plan_session',1);
  insert into public.billing_accounts(organisation_id,plan_key) select id,'active' from public.organisations;
  insert into public.credit_ledger(organisation_id,delta,reason,idempotency_key) select id,10,'grant','fixture:' || id from public.organisations;
  insert into public.credit_reservations(organisation_id,credits,action,status,expires_at)
    select id,2,'plan_session','held',now() + interval '1 hour' from public.organisations;
  insert into public.events(type,organisation_id,store_id,shopper_id)
    select 'scan',store.organisation_id,store.id,tests.get_supabase_uid('signed_in_shopper') from public.stores as store;
  insert into public.events(type,organisation_id,store_id,occurred_at)
    values ('scan','10000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001',now() - interval '2 hours');
  perform private.rollup_events(now() - interval '3 hours',now() + interval '1 second');
  insert into public.saved_reports(organisation_id,name,query) select id,'Fixture report','{}' from public.organisations;
  insert into public.prompt_versions(key,version,model,status) values ('fixture',1,'fixture','test');
  insert into public.llm_calls(purpose,prompt_key,prompt_version,model,ok,organisation_id)
    select 'fixture','fixture',1,'fixture',true,id from public.organisations;
  insert into public.jobs(id,kind,payload,organisation_id) values
    ('b0000000-0000-0000-0000-000000000001','music_analyse','{}','10000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000002','video_analyse','{}','10000000-0000-0000-0000-000000000002');
end;
$$;
comment on function tests.create_operations_fixture() is 'Creates two retailers with allowances, held credits, recent and older events, reports and trusted worker records.';
