begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users(id,email,email_confirmed_at) values
 ('94000000-0000-4000-8000-000000000001','cake-admin@example.test',now()),
 ('94000000-0000-4000-8000-000000000002','cake-member@example.test',now());
insert into public.user_roles(user_id,role_id)
 select '94000000-0000-4000-8000-000000000001',id from public.roles where key='admin'
 on conflict(user_id) do update set role_id=excluded.role_id;
insert into public.firework_effects(id,slug,name,pattern_key,model_json)
 values('94000000-0000-4000-8000-000000000011','cake-test-effect','Cake test effect','sphere','{"renderDefaults":{"geometry":"sphere"}}');
insert into public.fireworks(id,slug,name,firework_effect_id,duration_seconds,design,design_schema)
 values('94000000-0000-4000-8000-000000000012','cake-test-shell','Red Peony',
 '94000000-0000-4000-8000-000000000011',5,
 '{"kind":"shell","launch":{"height_m":66,"time_s":1.887855926706273,"tilt_deg":0,"tail":"silver","sparks":180,"spread":1.4,"smoke":1},"breaks":[{"at_s":0,"core":{"enabled":true,"colour":"#ff3b2f","count":110,"radius":0.5,"flash":1,"flash_on":true,"ring":false},"fade":{"white_hot":0.03,"ember_at":0.8,"fade_at":0.72,"prime_s":0.25},"layers":[{"id":"l1","name":"Big stars","pattern":"sphere","count":40,"radius_m":27,"tilt":0.4,"speed_var":0.22,"drag_per_s":1.6,"gravity_m_s2":6,"life_s":3,"life_var":0.2,"delay_s":0,"offset_m":[0,0,0],"flash":true,"hidden":false,"colour":{"mode":"solid","stops":[[0,["#ff4f6a"]],[1,["#ff4f6a"]]]},"brightness":[[0,1.3],[1,1.3]],"head":{"size":1.8,"visible":true},"trail":{"sparks":34,"length_s":0.5,"spread_m_s":0.25,"gravity_m_s2":3,"drag_per_s":2.6,"size":1.4,"flicker":0.3,"colour":"star","glitter":0,"glitter_delay_s":0.35,"fork":0},"modifiers":[]}]}],"ground":null,"sound":{"lift":0.7,"break":0.85,"crackle":0.6,"whistle":0},"seed":11}'::jsonb,1);

insert into public.multishots(id,slug,name) values('94000000-0000-4000-8000-000000000021','cake-test','Cake test');
insert into public.multishot_fireworks(multishot_id,firework_id,sequence_index,time_offset_seconds)
 values('94000000-0000-4000-8000-000000000021','94000000-0000-4000-8000-000000000012',1,0);

create function pg_temp.import_shots(p_second numeric default 0.251) returns jsonb language sql as $$
 select jsonb_build_array(
  jsonb_build_object('sequence_index',1,'firework_id','94000000-0000-4000-8000-000000000012','time_offset_seconds',0,'pan_degrees',-30,'tilt_degrees',0),
  jsonb_build_object('sequence_index',2,'firework_id','94000000-0000-4000-8000-000000000012','time_offset_seconds',p_second,'pan_degrees',30,'tilt_degrees',0));
$$;
-- Materialise fixtures before SET ROLE: executing a postgres-owned pg_temp
-- helper as authenticated crashes the local PostgreSQL backend. The RPC calls
-- below still run as their actual callers.
select pg_temp.import_shots() as valid_shots, pg_temp.import_shots(3600) as overlong_shots \gset
select ok(not has_function_privilege('anon','public.save_multishot_composition(uuid,timestamptz,jsonb)','execute'),'anonymous RPC access revoked');
select ok(has_function_privilege('authenticated','public.save_multishot_composition(uuid,timestamptz,jsonb)','execute'),'authenticated RPC access granted');
select ok(not has_table_privilege('authenticated','public.multishot_composition_versions','insert'),'history cannot be forged directly');
select set_config('request.jwt.claim.sub','94000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select is(public.save_multishot_composition('94000000-0000-4000-8000-000000000021',now(),:'valid_shots'::jsonb)->>'ok','false','member cannot import');
select is((select count(*)::integer from public.multishot_composition_versions),0,'member cannot read history');
reset role;
select set_config('request.jwt.claim.sub','94000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select is(public.save_multishot_composition('94000000-0000-4000-8000-000000000021',
 (select updated_at from public.multishots where id='94000000-0000-4000-8000-000000000021'),:'valid_shots'::jsonb)->>'ok','true','admin replaces composition');
select is((select count(*)::integer from public.multishot_fireworks where multishot_id='94000000-0000-4000-8000-000000000021'),2,'all imported shots saved');
select is((select time_offset_seconds from public.multishot_fireworks where multishot_id='94000000-0000-4000-8000-000000000021' and sequence_index=2),0.251::numeric,'milliseconds retained');
select is((select shot_count from public.multishots where id='94000000-0000-4000-8000-000000000021'),2,'existing derived-state path synchronised');
select is((select jsonb_array_length(before_shots) from public.multishot_composition_versions where multishot_id='94000000-0000-4000-8000-000000000021'),1,'history records prior shots');
select is((select jsonb_array_length(after_shots) from public.multishot_composition_versions where multishot_id='94000000-0000-4000-8000-000000000021'),2,'history records saved shots');
select is(public.save_multishot_composition('94000000-0000-4000-8000-000000000021',now() - interval '1 day',:'valid_shots'::jsonb)->>'ok','false','stale preview rejected');
select is(public.save_multishot_composition('94000000-0000-4000-8000-000000000021',
 (select updated_at from public.multishots where id='94000000-0000-4000-8000-000000000021'),:'overlong_shots'::jsonb)->>'ok','false','duration failure rolls back composition');
select is((select time_offset_seconds from public.multishot_fireworks where multishot_id='94000000-0000-4000-8000-000000000021' and sequence_index=2),0.251::numeric,'prior shots survive failed replacement');
select is((select count(*)::integer from public.multishot_composition_versions where multishot_id='94000000-0000-4000-8000-000000000021'),1,'failed imports create no history');
select is(public.save_multishot_composition('94000000-0000-4000-8000-000000000021',
 (select updated_at from public.multishots where id='94000000-0000-4000-8000-000000000021'),'[{"firework_id":null}]')->>'ok','false','incomplete shots refused');
reset role;
select * from finish();
rollback;
