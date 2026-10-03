-- Atomic trusted plan storage, shopper isolation, credit replay and bounded alternatives.
select no_plan();
select tests.create_operations_fixture();
create function tests.planner_snapshot() returns jsonb language sql stable as $$
  select jsonb_build_object('answers','{}'::jsonb,'age_confirmation',jsonb_build_object('confirmed_at',now()));
$$;
create function tests.planner_candidate(p_rank int default 1) returns jsonb language sql stable as $$
  select jsonb_build_object('rank',p_rank,'mood','balanced','cues',tests.show_cues(),
    'total_minor',2500,'currency','GBP','duration_ms',6000,'scores','{}'::jsonb);
$$;
select tests.act_as_public();
select ok(public.planner_context('90000000-0000-0000-0000-000000000001') is not null,'public may read only planning facts');
select is(public.planner_context('00000000-0000-0000-0000-000000000000'),null::jsonb,'unknown store has no planner');
select throws_ok($$select public.persist_planner_result(null,gen_random_uuid(),null,'{}','hash','fixture','{}')$$,'42501',null,'public cannot write solver snapshots');
reset role;
select tests.act_as('anonymous_shopper');
select throws_ok($$select public.persist_planner_result(null,gen_random_uuid(),null,'{}','hash','fixture','{}')$$,'42501',null,'anonymous shopper cannot author money');
reset role;
set local role service_role;
select lives_ok($$select public.persist_planner_result(tests.get_supabase_uid('anonymous_shopper'),
  'c0000000-0000-4000-8000-000000000001','90000000-0000-0000-0000-000000000001',tests.planner_snapshot(),'hash','fixture',tests.planner_candidate())$$,'trusted boundary writes plan and candidate');
select lives_ok($$select public.persist_planner_result(tests.get_supabase_uid('anonymous_shopper'),
  'c0000000-0000-4000-8000-000000000001','90000000-0000-0000-0000-000000000001',tests.planner_snapshot(),'hash','fixture',tests.planner_candidate())$$,'replay succeeds');
reset role;
select is((select count(*) from public.credit_ledger where ref_id = 'c0000000-0000-4000-8000-000000000001'),1::bigint,'exactly one session spend');
select is((select count(*) from public.plan_candidates where session_id = 'c0000000-0000-4000-8000-000000000001'),1::bigint,'replay stores one candidate');
set local role service_role;
select throws_ok($$select public.persist_planner_result(tests.get_supabase_uid('signed_in_shopper'),
  'c0000000-0000-4000-8000-000000000001','90000000-0000-0000-0000-000000000001',tests.planner_snapshot(),'hash','fixture',tests.planner_candidate())$$,'42501',null,'trusted call still cannot reassign ownership');
select lives_ok($$select public.persist_planner_result(tests.get_supabase_uid('anonymous_shopper'),
  'c0000000-0000-4000-8000-000000000001','90000000-0000-0000-0000-000000000001',tests.planner_snapshot(),'hash','fixture',tests.planner_candidate(2))$$,'alternative reuses session');
select throws_ok($$select public.persist_planner_result(tests.get_supabase_uid('anonymous_shopper'),
  'c0000000-0000-4000-8000-000000000001','90000000-0000-0000-0000-000000000001',tests.planner_snapshot(),'hash','fixture',tests.planner_candidate(4))$$,'23514',null,'cannot skip alternative ranks');
reset role;
select is((select count(*) from public.credit_ledger where ref_id = 'c0000000-0000-4000-8000-000000000001'),1::bigint,'alternative adds no spend');
select tests.act_as('anonymous_shopper');
select is((select count(*) from public.plan_sessions where id = 'c0000000-0000-4000-8000-000000000001'),1::bigint,'anonymous owner resumes session');
select is((select count(*) from public.plan_candidates where session_id = 'c0000000-0000-4000-8000-000000000001'),2::bigint,'owner reads candidate history');
reset role;
select tests.act_as('signed_in_shopper');
select is((select count(*) from public.plan_sessions where id = 'c0000000-0000-4000-8000-000000000001'),0::bigint,'other shopper cannot resume');
select is((select count(*) from public.plan_candidates where session_id = 'c0000000-0000-4000-8000-000000000001'),0::bigint,'other shopper cannot read candidates');
reset role;
insert into public.rate_limit_buckets(key,tokens,refilled_at) values
  ('planner:alternative:' || tests.get_supabase_uid('anonymous_shopper'),0,clock_timestamp())
  on conflict (key) do update set tokens = 0,refilled_at = clock_timestamp();
set local role service_role;
select throws_ok($$select public.persist_planner_result(tests.get_supabase_uid('anonymous_shopper'),
  'c0000000-0000-4000-8000-000000000001','90000000-0000-0000-0000-000000000001',tests.planner_snapshot(),'hash','fixture',tests.planner_candidate(3))$$,'P0001','Planner rate limit reached','alternative bucket enforced');
reset role;
insert into public.rate_limit_buckets(key,tokens,refilled_at) values
  ('planner:start:' || tests.get_supabase_uid('signed_in_shopper'),0,clock_timestamp());
set local role service_role;
select throws_ok($$select public.persist_planner_result(tests.get_supabase_uid('signed_in_shopper'),
  'c0000000-0000-4000-8000-000000000002','90000000-0000-0000-0000-000000000001',tests.planner_snapshot(),'hash','fixture',tests.planner_candidate())$$,'P0001','Planner rate limit reached','start bucket enforced');
reset role;
update public.rate_limit_buckets set tokens = 3 where key = 'planner:start:' || tests.get_supabase_uid('signed_in_shopper');
insert into public.credit_ledger(organisation_id,delta,reason,idempotency_key)
  values ('10000000-0000-0000-0000-000000000002',-10,'spend','drain-test');
set local role service_role;
select throws_ok($$select public.persist_planner_result(tests.get_supabase_uid('signed_in_shopper'),
  'c0000000-0000-4000-8000-000000000003','90000000-0000-0000-0000-000000000002',tests.planner_snapshot(),'hash','fixture',tests.planner_candidate())$$,'23514','Insufficient planning credits','no credits refuses plan');
reset role;
select is((select count(*) from public.plan_sessions where id = 'c0000000-0000-4000-8000-000000000003'),0::bigint,'credit failure rolls session back');
select is((select count(*) from public.plan_candidates where session_id = 'c0000000-0000-4000-8000-000000000003'),0::bigint,'credit failure stores no candidate');
-- Local-calendar sale rules include wraparound and refuse unsupported feast dates.
update public.stores set licence = 'seasonal' where id = '90000000-0000-0000-0000-000000000001';
insert into public.sale_periods(market,name,rule) values ('GB','Open test','{"type":"fixed","from":"01-01","to":"12-31"}');
select ok(private.planner_sale_open('90000000-0000-0000-0000-000000000001'),'matching fixed annual period opens');
delete from public.sale_periods;
select ok(not private.planner_sale_open('90000000-0000-0000-0000-000000000001'),'seasonal shop fails closed without calendar');
insert into public.sale_periods(market,name,rule) values ('GB','Unknown feast','{"type":"before_feast","feast":"unknown"}');
select ok(not private.planner_sale_open('90000000-0000-0000-0000-000000000001'),'unsupported feast does not permit sales');
select * from finish();
