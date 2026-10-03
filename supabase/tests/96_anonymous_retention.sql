-- Anonymous account cleanup retains consent, history and recently active accounts.
select no_plan();
select tests.create_shoppers_fixture();
select tests.create_supabase_user('old_empty');
select tests.create_supabase_user('recent');
select tests.create_supabase_user('boundary');
select tests.create_supabase_user('old_active');
select tests.create_supabase_user('old_upgraded');
select tests.create_supabase_user('old_history');
select tests.create_supabase_user('old_asset');
select tests.create_supabase_user('old_follow');
select tests.create_supabase_user('old_list');
select tests.create_supabase_user('old_member');
select tests.create_supabase_user('old_privacy');
update auth.users set is_anonymous = true,created_at = now()-interval '31 days',last_sign_in_at = null
  where id in (select tests.get_supabase_uid(name) from unnest(array['old_empty','recent','boundary','old_active','old_history','old_asset','old_follow','old_list','old_member','old_privacy']) as persona(name));
update public.profiles set created_at = now()-interval '31 days',last_seen_at = null
  where is_anonymous;
update auth.users set created_at = now()-interval '30 days' where id = tests.get_supabase_uid('boundary');
update auth.users set created_at = now() where id = tests.get_supabase_uid('recent');
update public.profiles set last_seen_at = now() where id = tests.get_supabase_uid('old_active');
update auth.users set created_at = now()-interval '31 days' where id = tests.get_supabase_uid('old_upgraded');
update public.profiles set created_at = now()-interval '31 days' where id = tests.get_supabase_uid('old_upgraded');
insert into public.shows(owner_id,name,origin) values(tests.get_supabase_uid('old_history'),'Retained show','manual');
insert into storage.objects(bucket_id,name) values('exports',tests.get_supabase_uid('old_asset')::text || '/retained');
insert into public.follows(shopper_id,organisation_id,consent_text_version)
  values(tests.get_supabase_uid('old_follow'),'10000000-0000-0000-0000-000000000001','fixture');
insert into public.lists(shopper_id,store_id,till_code,valid_until)
  values(tests.get_supabase_uid('old_list'),'90000000-0000-0000-0000-000000000001','5555555555555555',current_date);
insert into public.memberships(organisation_id,profile_id,role)
  values('10000000-0000-0000-0000-000000000001',tests.get_supabase_uid('old_member'),'staff');
insert into public.privacy_requests(shopper_id,kind) values(tests.get_supabase_uid('old_privacy'),'delete');
insert into public.plan_sessions(shopper_id,store_id,answers,solver,input_hash)
  values(tests.get_supabase_uid('old_empty'),'90000000-0000-0000-0000-000000000001','{}','fixture','disposable');
create temporary table deleted_identity as select tests.get_supabase_uid('old_empty') as id;
select is(private.purge_inactive_anonymous_users(),1::bigint,'only old empty anonymous account is purged');
select ok(not exists(select from auth.users where id = (select id from deleted_identity)),'Auth identity removed');
select ok(not exists(select from public.profiles where id = (select id from deleted_identity)),'profile cascades');
select ok(not exists(select from public.plan_sessions where input_hash = 'disposable'),'unused plan session cascades');
select ok(exists(select from auth.users where id = tests.get_supabase_uid(persona.name)),persona.name || ' retained')
  from unnest(array['recent','boundary','old_active','old_upgraded','old_history','old_asset','old_follow','old_list','old_member','old_privacy','anonymous_shopper','signed_in_shopper']) as persona(name);
select is(private.purge_inactive_anonymous_users(),0::bigint,'purge rerun is idempotent');
select finish();
