begin;

insert into auth.users (id, email, email_confirmed_at) values
 ('93000000-0000-4000-8000-000000000001','editor-transaction-admin@example.test',now()),
 ('93000000-0000-4000-8000-000000000002','editor-transaction-member@example.test',now());
insert into public.user_roles(user_id,role_id)
 select '93000000-0000-4000-8000-000000000001', id from public.roles where key='admin'
 on conflict(user_id) do update set role_id=excluded.role_id;
insert into public.firework_effects(id,slug,name,pattern_key,model_json)
 values('93000000-0000-4000-8000-000000000011','transaction-test-effect','Original effect','sphere','{"renderDefaults":{"geometry":"sphere"}}');
insert into public.fireworks(id,slug,name,firework_effect_id,render_overrides_json)
 values('93000000-0000-4000-8000-000000000012','transaction-test-firework','Original firework',
 '93000000-0000-4000-8000-000000000011','{"geometry":"sphere","stars":{"outer":{"head":{}}},"launch":{"shell":{}}}');
insert into public.firework_style_defaults(id,slug,name,kind,defaults_json)
 values('93000000-0000-4000-8000-000000000013','transaction-test-style','Original style','innerStar','{}');

-- The caller must be an authenticated catalogue administrator, including when
-- the function is reached from a privileged service connection.
do $$
declare uid uuid;
begin
 if has_function_privilege('anon','public.save_firework_editor(text,uuid,timestamptz,jsonb,uuid,text,uuid,jsonb)','execute') then
   raise exception 'Anonymous save grant';
 end if;
 if not has_function_privilege('authenticated','public.save_firework_editor(text,uuid,timestamptz,jsonb,uuid,text,uuid,jsonb)','execute') then
   raise exception 'Authenticated save grant missing';
 end if;
 foreach uid in array array[null::uuid,'93000000-0000-4000-8000-000000000002'::uuid] loop
   perform set_config('request.jwt.claim.sub',coalesce(uid::text,''),true);
   begin
     perform public.save_firework_editor('effect','93000000-0000-4000-8000-000000000011',now(),'{}',gen_random_uuid());
     raise exception 'Unauthorised save succeeded';
   exception when insufficient_privilege then null;
   end;
 end loop;
end $$;

select set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$
declare
 target record;
 before_row jsonb;
 after_row jsonb;
 response jsonb;
 version public.firework_editor_versions;
 before_time timestamptz;
 current_time_value timestamptz;
 version_id uuid;
 restore_id uuid;
 patch jsonb;
 inline jsonb;
 before_count integer;
begin
 for target in select * from (values
   ('effect','firework_effects','93000000-0000-4000-8000-000000000011'::uuid),
   ('firework','fireworks','93000000-0000-4000-8000-000000000012'::uuid),
   ('style_default','firework_style_defaults','93000000-0000-4000-8000-000000000013'::uuid)
 ) as targets(kind,table_name,id) loop
   execute format('select to_jsonb(t) from public.%I t where id=$1',target.table_name) into before_row using target.id;
   before_time := (before_row->>'updated_at')::timestamptz;
   patch := jsonb_build_object('name','Saved '||target.kind);
   version_id := gen_random_uuid();
   response := public.save_firework_editor(target.kind,target.id,before_time,patch,version_id);
   if response->>'ok' <> 'true' then raise exception 'Valid save failed: %',response; end if;
   execute format('select to_jsonb(t) from public.%I t where id=$1',target.table_name) into after_row using target.id;
   select * into strict version from public.firework_editor_versions where id=version_id;
   if version.snapshot_json->>'name' <> 'Saved '||target.kind
     or version.previous_snapshot_json->>'name' <> before_row->>'name'
     or version.snapshot_json->>'updatedAt' <> after_row->>'updated_at'
     or version.created_by <> auth.uid()
     or version.changes_json->'name' <> jsonb_build_object('before',before_row->'name','after','Saved '||target.kind)
     or after_row->>'slug' <> before_row->>'slug' then
     raise exception 'Saved row, previous state and history disagree for %',target.kind;
   end if;
   if target.kind='firework' and version.snapshot_json->'renderOverridesJson' <> after_row->'render_snapshot_json' then
     raise exception 'History does not contain the resolved appearance';
   end if;
   current_time_value := (after_row->>'updated_at')::timestamptz;
   -- Stale save creates neither history nor an inline preset.
   inline := case when target.kind<>'style_default' then jsonb_build_object('slug','stale-'||target.kind,'name','Stale preset','kind','innerTrail','defaults_json','{}'::jsonb) end;
   select count(*) into before_count from public.firework_editor_versions;
   response := public.save_firework_editor(target.kind,target.id,before_time,patch,gen_random_uuid(),'update',null,inline);
   if response->>'code' <> 'conflict' or (select count(*) from public.firework_editor_versions) <> before_count
     or exists(select 1 from public.firework_style_defaults where slug='stale-'||target.kind) then
     raise exception 'Stale save wrote data';
   end if;
   -- Force the final history insert to fail after the record and preset writes.
   inline := case when target.kind<>'style_default' then jsonb_build_object('slug','rollback-'||target.kind,'name','Rolled back preset','kind','innerStar','defaults_json','{}'::jsonb) end;
   begin
     perform public.save_firework_editor(target.kind,target.id,current_time_value,'{"name":"Must roll back"}',version_id,'update',null,inline);
     raise exception 'Duplicate history id did not fail';
   exception when unique_violation then null;
   end;
   execute format('select to_jsonb(t) from public.%I t where id=$1',target.table_name) into response using target.id;
   if response <> after_row or exists(select 1 from public.firework_style_defaults where slug='rollback-'||target.kind)
     or (select count(*) from public.firework_editor_versions) <> before_count then
     raise exception 'History failure left a partial save';
   end if;
   begin
     perform public.save_firework_editor(target.kind,target.id,current_time_value,'{"id":"93000000-0000-4000-8000-000000000099"}',gen_random_uuid());
     raise exception 'Protected field accepted';
   exception when invalid_parameter_value then null;
   end;
   begin
     perform public.save_firework_editor(target.kind,target.id,current_time_value,patch,gen_random_uuid(),'restore',gen_random_uuid());
     raise exception 'Foreign restore version accepted';
   exception when invalid_parameter_value then null;
   end;
   restore_id := gen_random_uuid();
   response := public.save_firework_editor(target.kind,target.id,current_time_value,patch,restore_id,'restore',version_id);
   if response->>'ok' <> 'true' or not exists(select 1 from public.firework_editor_versions where id=restore_id and action='restore') then
     raise exception 'Restore and history did not commit together';
   end if;
   current_time_value := (response#>>'{saved,updated_at}')::timestamptz;
   if target.kind='style_default' then
     response := public.save_firework_editor(target.kind,target.id,current_time_value,'{"is_archived":true}',gen_random_uuid());
     if response#>>'{saved,is_archived}' <> 'true' or response#>>'{historyVersion,snapshot_json,isArchived}' <> 'true' then
       raise exception 'Archive history disagrees';
     end if;
   else
     inline := jsonb_build_object('slug','commit-'||target.kind,'name','Copied preset','kind','innerTrail','defaults_json','{"stars":{"core":{"enabled":true}}}'::jsonb);
     response := public.save_firework_editor(target.kind,target.id,current_time_value,patch,gen_random_uuid(),'update',null,inline);
     if response#>>'{styleDefault,kind}' <> 'innerTrail' or response#>>'{historyVersion,target_kind}' <> target.kind then
       raise exception 'Inline preset and history did not commit together';
     end if;
   end if;
 end loop;
end $$;
reset role;
rollback;
