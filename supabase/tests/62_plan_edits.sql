-- Atomic non-AI edit history, revisions, replay, stale writes and shopper isolation.
select no_plan();
select tests.create_operations_fixture();
create function tests.edit_snapshot() returns jsonb language sql stable as $$
  select jsonb_build_object('store_id','90000000-0000-0000-0000-000000000001',
    'answers','{"budget_minor":3000}'::jsonb,'age_confirmation',jsonb_build_object('confirmed_at',now()));
$$;
create function tests.edit_candidate() returns jsonb language sql stable as $$
  select jsonb_build_object('rank',1,'name','Colour celebration: Test for Birthday','mood','balanced',
    'cues',tests.show_cues(),'total_minor',2500,'currency','GBP','duration_ms',6000,'scores','{}'::jsonb);
$$;
create function tests.edit_document(p_id text default 'd0000000-0000-4000-8000-000000000001',p_outcome text default 'applied')
returns jsonb language sql as $$
  select jsonb_build_object('id',p_id,'source','chip','message','Cheaper','ops','[{"op":"set_budget","max_minor":3000}]'::jsonb,
    'diff',case when p_outcome = 'applied' then '{"added":[],"removed":[],"total_before":2500,"total_after":2500,"currency":"GBP"}'::jsonb else null end,
    'outcome',p_outcome,'reply','Changed your show.','input_hash','edited-hash');
$$;
create function tests.write_edit(p_revision int default 0,p_seq int default 1,p_hash text default 'hash',
  p_edit jsonb default tests.edit_document(),p_result jsonb default tests.edit_candidate(),p_shopper uuid default tests.get_supabase_uid('anonymous_shopper'))
returns uuid language sql as $$
  select public.persist_plan_edit(p_shopper,'c0000000-0000-4000-8000-000000000001',
    (select id from public.plan_candidates where session_id = 'c0000000-0000-4000-8000-000000000001'),
    p_revision,p_seq,p_hash,p_edit,tests.edit_snapshot(),p_result);
$$;
set local role service_role;
select public.persist_planner_result(tests.get_supabase_uid('anonymous_shopper'),
  'c0000000-0000-4000-8000-000000000001','90000000-0000-0000-0000-000000000001',
  tests.edit_snapshot(),'hash','fixture',tests.edit_candidate());
reset role;
select tests.act_as_public();
select throws_ok($$select tests.write_edit()$$,'42501',null,'public cannot author edits');
reset role;
select tests.act_as('anonymous_shopper');
select throws_ok($$select tests.write_edit()$$,'42501',null,'shopper cannot author solver results');
reset role;
set local role service_role;
select throws_ok($$select tests.write_edit(p_shopper := tests.get_supabase_uid('signed_in_shopper'))$$,'42501',null,'trusted call cannot edit another shopper session');
select throws_ok($$select tests.write_edit(p_revision := 1)$$,'40001',null,'stale candidate revision refused');
select throws_ok($$select tests.write_edit(p_seq := 2)$$,'40001',null,'stale history sequence refused');
select throws_ok($$select tests.write_edit(p_hash := 'wrong')$$,'40001',null,'changed input snapshot refused');
select throws_ok($$select tests.write_edit(p_edit := tests.edit_document() || '{"source":"llm"}')$$,'23514',null,'AI source refused');
select throws_ok($$select tests.write_edit(p_result := null)$$,'23514',null,'applied outcome needs a solved result');
select lives_ok($$select tests.write_edit()$$,'service atomically writes applied edit');
select lives_ok($$select tests.write_edit()$$,'same request replays without another revision or rate token');
reset role;
select is((select revision from public.plan_candidates where session_id = 'c0000000-0000-4000-8000-000000000001'),1,'revision increased once');
select is((select count(*) from public.plan_edits where session_id = 'c0000000-0000-4000-8000-000000000001'),1::bigint,'retry has one history row');
select is((select input_hash from public.plan_sessions where id = 'c0000000-0000-4000-8000-000000000001'),'edited-hash','session snapshot updated');
select is((select name from public.plan_candidates where session_id = 'c0000000-0000-4000-8000-000000000001'),'Colour celebration: Test for Birthday','template name stored');
select is((select count(*) from public.credit_ledger where ref_id = 'c0000000-0000-4000-8000-000000000001'),1::bigint,'edit has no additional credit charge');
set local role service_role;
select lives_ok($$select tests.write_edit(1,2,'edited-hash',tests.edit_document('d0000000-0000-4000-8000-000000000002','infeasible'),null)$$,'infeasible attempt recorded');
select lives_ok($$select tests.write_edit(1,3,'edited-hash',tests.edit_document('d0000000-0000-4000-8000-000000000003','clarify'),null)$$,'unmatched phrase recorded');
select throws_ok($$select tests.write_edit(1,4,'edited-hash',tests.edit_document('d0000000-0000-4000-8000-000000000004'),tests.edit_candidate() || '{"total_minor":3001}')$$,'23514',null,'budget breach refused atomically');
select throws_ok($$select tests.write_edit(1,4,'edited-hash',tests.edit_document('d0000000-0000-4000-8000-000000000004') || jsonb_build_object('message',repeat('x',301)),tests.edit_candidate())$$,'23514',null,'failed insert rolls back');
reset role;
select is((select revision from public.plan_candidates where session_id = 'c0000000-0000-4000-8000-000000000001'),1,'failed attempts keep previous show');
select is((select count(*) from public.plan_edits where session_id = 'c0000000-0000-4000-8000-000000000001'),3::bigint,'failed transaction does not write history');
select tests.act_as('anonymous_shopper');
select is((select count(*) from public.plan_edits where session_id = 'c0000000-0000-4000-8000-000000000001'),3::bigint,'anonymous owner reads persisted diff history');
reset role;
select tests.act_as('signed_in_shopper');
select is((select count(*) from public.plan_edits where session_id = 'c0000000-0000-4000-8000-000000000001'),0::bigint,'other shopper cannot read edits');
reset role;
update public.rate_limit_buckets set tokens = 0,refilled_at = clock_timestamp()
  where key = 'planner:edit:' || tests.get_supabase_uid('anonymous_shopper');
set local role service_role;
select throws_ok($$select tests.write_edit(1,4,'edited-hash',tests.edit_document('d0000000-0000-4000-8000-000000000004'))$$,'P0001','Planner rate limit reached','edit rate limit enforced');
reset role;
select is((select count(*) from public.plan_edits where session_id = 'c0000000-0000-4000-8000-000000000001'),3::bigint,'rate limit leaves history untouched');
select * from finish();
