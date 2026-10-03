-- Single-session charging, immutable facts and finance-authorised idempotent grants.
select no_plan();
select tests.create_operations_fixture();
select tests.act_as('organisation_owner');
select is(public.credit_balance('10000000-0000-0000-0000-000000000001'),8::bigint,'balance subtracts held reservations');
select throws_ok($$select public.credit_balance('10000000-0000-0000-0000-000000000002')$$,'42501',null,'foreign balance refused');
select throws_ok($$select public.grant_credits('10000000-0000-0000-0000-000000000001',5,'owner')$$,'42501',null,'retailer cannot grant itself credits');
reset role;
select tests.act_as('platform_staff');
select lives_ok($$select public.grant_credits('10000000-0000-0000-0000-000000000001',5,'replay')$$,'super admin grants credits');
select lives_ok($$select public.grant_credits('10000000-0000-0000-0000-000000000001',5,'replay')$$,'grant replay succeeds');
select is((select count(*) from public.credit_ledger where idempotency_key = 'grant:replay'),1::bigint,'replay creates one grant');
select throws_ok($$select public.grant_credits('10000000-0000-0000-0000-000000000001',6,'replay')$$,'23514',null,'inconsistent grant replay fails');
select throws_ok($$select public.grant_credits('10000000-0000-0000-0000-000000000002',5,'replay')$$,'23514',null,'grant key cannot cross organisations');
select throws_ok($$select public.grant_credits('10000000-0000-0000-0000-000000000001',0,'zero')$$,'23514',null,'zero grant rejected');
reset role;
update public.staff_roles set role = 'finance';
select tests.act_as('platform_staff');
select lives_ok($$select public.grant_credits('10000000-0000-0000-0000-000000000002',1,'finance')$$,'finance role grants credits');
reset role;
update public.staff_roles set role = 'support';
select tests.act_as('platform_staff');
select throws_ok($$select public.grant_credits('10000000-0000-0000-0000-000000000001',1,'support')$$,'42501',null,'support cannot grant credits');
reset role;
select tests.act_as('signed_in_shopper');
select lives_ok($$select public.start_plan_session('90000000-0000-0000-0000-000000000001','{}','fixture','charged',null,now())$$,'shopper starts paid session');
select ok((select credits_reservation_id is not null from public.plan_sessions where input_hash = 'charged'),'session points to settlement');
select ok(not has_function_privilege(current_user,'private.charge_plan_session(uuid)','EXECUTE'),'shopper cannot use internal charge boundary');
reset role;
select is((select count(*) from public.credit_ledger where ref_type = 'plan_session'),1::bigint,'one spend per session');
select is((select delta from public.credit_ledger where ref_type = 'plan_session'),-1,'session spends one credit');
select is((select status from public.credit_reservations where id = (select credits_reservation_id from public.plan_sessions where input_hash = 'charged')),'settled','reservation already settled');
select lives_ok($$select private.charge_plan_session((select id from public.plan_sessions where input_hash = 'charged'))$$,'internal charge replay succeeds');
select is((select count(*) from public.credit_ledger where ref_type = 'plan_session'),1::bigint,'replay leaves one spend');
select is(private.credit_balance('10000000-0000-0000-0000-000000000001'),12::bigint,'settlement is not subtracted twice');
insert into public.plan_candidates(session_id,rank,cues,total_minor,currency,duration_ms)
  select id,1,tests.show_cues(),2500,'GBP',6000 from public.plan_sessions where input_hash = 'charged';
insert into public.plan_edits(session_id,candidate_id,seq,source,ops,outcome)
  select session_id,id,1,'chip','[]','applied' from public.plan_candidates where session_id = (select id from public.plan_sessions where input_hash = 'charged');
insert into public.plan_candidates(session_id,rank,cues,total_minor,currency,duration_ms)
  select id,2,tests.show_cues(),2500,'GBP',6000 from public.plan_sessions where input_hash = 'charged';
select is((select count(*) from public.credit_ledger where ref_type = 'plan_session'),1::bigint,'edits and alternatives add no charge');
select throws_ok($$update public.credit_prices set credits = 2 where action = 'plan_session'$$,'23514',null,'session price cannot exceed one');
select throws_ok($$update public.credit_ledger set delta = 100$$,'23514',null,'even backend cannot rewrite ledger');
select throws_ok($$delete from public.credit_ledger$$,'23514',null,'even backend cannot delete ledger');
select throws_ok($$update public.plan_sessions set credits_reservation_id = gen_random_uuid() where input_hash = 'charged'$$,'23514',null,'recorded settlement cannot be replaced');
insert into public.credit_reservations(organisation_id,credits,action,status,expires_at)
  values ('10000000-0000-0000-0000-000000000001',1000,'plan_session','held',now() - interval '1 second');
select is(private.credit_balance('10000000-0000-0000-0000-000000000001'),12::bigint,'expired holds do not consume balance');
select is(private.release_expired_credit_reservations(),1::bigint,'cleanup releases stale hold');
select is(private.release_expired_credit_reservations(),0::bigint,'cleanup is rerunnable');
insert into public.credit_reservations(organisation_id,credits,action,status,expires_at)
  values ('10000000-0000-0000-0000-000000000002',9,'plan_session','held',now() + interval '1 hour');
select tests.act_as('anonymous_shopper');
select throws_ok($$select public.start_plan_session('90000000-0000-0000-0000-000000000002','{}','fixture','no-credits',null,now())$$,'23514',null,'insufficient credits refuse anonymous session');
reset role;
select is((select count(*) from public.plan_sessions where input_hash = 'no-credits'),0::bigint,'failed charge rolls back session');
select is((select count(*) from public.credit_ledger where ref_type = 'plan_session'),1::bigint,'failed charge adds no spend');
update public.credit_reservations set status = 'released' where organisation_id = '10000000-0000-0000-0000-000000000002';
select tests.act_as('anonymous_shopper');
select lives_ok($$select public.start_plan_session('90000000-0000-0000-0000-000000000002','{}','fixture','anonymous-paid',null,now())$$,'anonymous shopper starts credited session');
reset role;
select is((select count(*) from public.credit_ledger where ref_type = 'plan_session'),2::bigint,'anonymous session also charges once');
select throws_ok($$update public.plan_sessions set credits_reservation_id = (select credits_reservation_id from public.plan_sessions where input_hash = 'charged') where id = 'a0000000-0000-0000-0000-000000000002'$$,'23514',null,'session cannot claim another retailer settlement');
select throws_ok($$insert into public.plan_sessions(shopper_id,store_id,answers,solver,input_hash,credits_reservation_id) values (tests.get_supabase_uid('signed_in_shopper'),'90000000-0000-0000-0000-000000000001','{}','fixture','fake-reservation',gen_random_uuid())$$,'23514',null,'nonexistent settlement refused');
select * from finish();
