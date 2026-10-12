begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users(id,email,email_confirmed_at) values
 ('95000000-0000-4000-8000-000000000001','library-admin@example.test',now()),
 ('95000000-0000-4000-8000-000000000002','library-member@example.test',now());
insert into public.user_roles(user_id,role_id)
 select '95000000-0000-4000-8000-000000000001',id from public.roles where key='admin'
 on conflict(user_id) do update set role_id=excluded.role_id;

select ok(not has_table_privilege('anon','public.editor_library_parts','select'),'anonymous read revoked');
select ok(not has_table_privilege('authenticated','public.editor_library_parts','update'),'parts cannot be edited in place');
select ok(not has_column_privilege('authenticated','public.editor_library_parts','created_by','insert'),'author cannot be forged');

select set_config('request.jwt.claim.sub','95000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select throws_ok(
  $$insert into public.editor_library_parts(name,category,design) values('Gold willow','trails','{"kind":"shell"}')$$,
  '42501', null, 'member cannot save a part');
reset role;

select set_config('request.jwt.claim.sub','95000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select lives_ok(
  $$insert into public.editor_library_parts(name,category,design) values('Gold willow','trails','{"kind":"shell"}')$$,
  'catalogue editor saves a part');
select is((select created_by::text from public.editor_library_parts where name='Gold willow'),
  '95000000-0000-4000-8000-000000000001','saved part records its author');
select throws_ok(
  $$insert into public.editor_library_parts(name,category,design) values(' ','stars','{"kind":"shell"}')$$,
  '23514', null, 'blank names are refused');
select throws_ok(
  $$insert into public.editor_library_parts(name,category,design) values('Odd','fireworks','{"kind":"shell"}')$$,
  '23514', null, 'unknown categories are refused');
reset role;

select set_config('request.jwt.claim.sub','95000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select is((select count(*)::integer from public.editor_library_parts),0,'member cannot read parts');
delete from public.editor_library_parts;
reset role;
select is((select count(*)::integer from public.editor_library_parts),1,'member cannot delete parts');

select set_config('request.jwt.claim.sub','95000000-0000-4000-8000-000000000001',true);
set local role authenticated;
delete from public.editor_library_parts where name='Gold willow';
reset role;
select is((select count(*)::integer from public.editor_library_parts),0,'catalogue editor deletes a part');

select * from finish();
rollback;
