begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users(id,email,email_confirmed_at) values
 ('95000000-0000-4000-8000-000000000001','vdl-admin@example.test',now()),
 ('95000000-0000-4000-8000-000000000002','vdl-member@example.test',now());
insert into public.user_roles(user_id,role_id)
 select '95000000-0000-4000-8000-000000000001',id from public.roles where key='admin'
 on conflict(user_id) do update set role_id=excluded.role_id;
insert into public.firework_effects(id,slug,name,pattern_key,model_json)
 values('95000000-0000-4000-8000-000000000011','vdl-test-effect','VDL test effect','sphere','{"renderDefaults":{"geometry":"sphere"}}');

create function pg_temp.design() returns jsonb language sql as $$
 select '{"kind":"shell","launch":{"height_m":30,"time_s":1.94,"tilt_deg":0,"tail":"silver","sparks":180,"spread":1.4,"smoke":1},"breaks":[{"at_s":0,"core":{"enabled":true,"colour":"#ff3b2f","count":110,"radius":0.5,"flash":1,"flash_on":true,"ring":false},"fade":{"white_hot":0.03,"ember_at":0.8,"fade_at":0.72,"prime_s":0.25},"layers":[{"id":"l1","name":"Stars","pattern":"sphere","count":40,"radius_m":9,"tilt":0.4,"speed_var":0.22,"drag_per_s":1.6,"gravity_m_s2":6,"life_s":3,"life_var":0.2,"delay_s":0,"offset_m":[0,0,0],"flash":true,"hidden":false,"colour":{"mode":"solid","stops":[[0,["#ff4f6a"]],[1,["#ff4f6a"]]]},"brightness":[[0,1.3],[1,1.3]],"head":{"size":1.8,"visible":true},"trail":{"sparks":34,"length_s":0.5,"spread_m_s":0.25,"gravity_m_s2":3,"drag_per_s":2.6,"size":1.4,"flicker":0.3,"colour":"star","glitter":0,"glitter_delay_s":0.35,"fork":0},"modifiers":[]}]}],"ground":null,"sound":{"lift":0.7,"break":0.85,"crackle":0.6,"whistle":0},"seed":11}'::jsonb;
$$;
insert into public.fireworks(id,slug,name,firework_effect_id,duration_seconds,design,design_schema)
 values('95000000-0000-4000-8000-000000000012','vdl-existing','30mm Red Peony','95000000-0000-4000-8000-000000000011',5,pg_temp.design(),1);

create function pg_temp.new_fireworks() returns jsonb language sql as $$
 select jsonb_build_array(jsonb_build_object(
  'key','30mm blue peony','template_key','vdl-test-template','template_name','VDL test template',
  'template_design',pg_temp.design(),'name','30mm Blue Peony','design',pg_temp.design(),
  'model','{"geometry":"sphere"}'::jsonb,'render_snapshot','{"geometry":"sphere"}'::jsonb,
  'duration_seconds',5,'caliber','30mm','height_meters',30));
$$;
create function pg_temp.shots(p_pan integer default 10) returns jsonb language sql as $$
 select jsonb_build_array(
  jsonb_build_object('sequence_index',1,'firework_key','30mm blue peony','time_offset_seconds',0,'pan_degrees',-10),
  jsonb_build_object('sequence_index',2,'firework_id','95000000-0000-4000-8000-000000000012','time_offset_seconds',0.25,'pan_degrees',p_pan));
$$;
-- Materialise fixtures before SET ROLE; postgres-owned pg_temp helpers cannot run as authenticated.
select pg_temp.new_fireworks() as new_fireworks, pg_temp.shots() as valid_shots, pg_temp.shots(45) as wide_shots \gset

select ok(not has_function_privilege('anon','public.create_vdl_multishot(text,text,jsonb,jsonb)','execute'),'anonymous RPC access revoked');
select ok(has_function_privilege('authenticated','public.create_vdl_multishot(text,text,jsonb,jsonb)','execute'),'authenticated RPC access granted');
select ok(not has_table_privilege('anon','public.vdl_glossary_terms','select'),'anonymous glossary access revoked');

select set_config('request.jwt.claim.sub','95000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select is(public.create_vdl_multishot('Member cake',null,:'new_fireworks'::jsonb,:'valid_shots'::jsonb)->>'ok','false','member cannot import');
select throws_ok($$insert into public.vdl_glossary_terms(phrase,definition) values('peony','{"type":"ignore"}')$$,'42501',null,'member cannot add words');
reset role;

select set_config('request.jwt.claim.sub','95000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select is(public.create_vdl_multishot('Wide cake',null,:'new_fireworks'::jsonb,:'wide_shots'::jsonb)->>'ok','false','pan beyond the limit is refused');
select is((select count(*)::integer from public.fireworks where name='30mm Blue Peony'),0,'a refused import creates no fireworks');
select is((select count(*)::integer from public.multishots where name='Wide cake'),0,'a refused import creates no multishot');
select is(public.create_vdl_multishot('30mm 2 Shot Cake','(a) Blue Peony',:'new_fireworks'::jsonb,:'valid_shots'::jsonb)->>'ok','true','admin creates a multishot');
select is((select count(*)::integer from public.multishot_fireworks s join public.multishots m on m.id=s.multishot_id where m.name='30mm 2 Shot Cake'),2,'every shot saved');
select is((select time_offset_seconds from public.multishot_fireworks s join public.multishots m on m.id=s.multishot_id where m.name='30mm 2 Shot Cake' and s.sequence_index=2),0.25::numeric,'milliseconds retained');
select is((select shot_count from public.multishots where name='30mm 2 Shot Cake'),2,'derived state synchronised');
select is((select is_listed from public.catalogue_items c join public.fireworks f on f.id=c.firework_id where f.name='30mm Blue Peony'),false,'imported parts are not listed products');
select is((select caliber from public.fireworks where name='30mm Blue Peony'),'30mm','caliber stored');
select ok((select design is not null from public.firework_effects where template_key='vdl-test-template'),'base effect keeps the template design');
select is((select jsonb_array_length(after_shots) from public.multishot_composition_versions v join public.multishots m on m.id=v.multishot_id where m.name='30mm 2 Shot Cake'),2,'history records the created shots');
select lives_ok($$insert into public.vdl_glossary_terms(phrase,definition) values('peony','{"type":"effect","template":"dahlia","family":"shell"}')$$,'admin adds a word');
select throws_ok($$insert into public.vdl_glossary_terms(phrase,definition) values('Peony Two','{"type":"ignore"}')$$,'23514',null,'phrases are stored lower-case');
select is((select count(*)::integer from public.vdl_glossary_terms),1,'admin reads words');
reset role;
select * from finish();
rollback;
