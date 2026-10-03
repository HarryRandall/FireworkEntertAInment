-- Consent uses caller identity, independent organisation choices and database timestamps.
select no_plan();
select tests.create_shoppers_fixture();
select ok(not has_function_privilege('anon','public.save_shopper_consent(uuid,boolean,boolean,text)','execute'),'public requests cannot call consent wrapper');
select ok(not has_function_privilege('anon','private.save_shopper_consent(uuid,boolean,boolean,text)','execute'),'public requests cannot call consent implementation');
select ok(not has_function_privilege('service_role','private.save_shopper_consent(uuid,boolean,boolean,text)','execute'),'backend has no consent execution grant');
select ok(not has_column_privilege('authenticated','public.follows','shopper_id','update'),'shopper identity stays protected');
select ok(not has_column_privilege('authenticated','public.follows','organisation_id','update'),'organisation identity stays protected');
select tests.act_as('signed_in_shopper');
select throws_ok($$insert into public.follows(shopper_id,organisation_id,visible_to_shop,marketing_opt_in,consent_text_version)
  values (private.uid(),'10000000-0000-0000-0000-000000000001',false,true,'choices')
  on conflict (shopper_id,organisation_id) do update set shopper_id = excluded.shopper_id,
    organisation_id = excluded.organisation_id,visible_to_shop = excluded.visible_to_shop,
    marketing_opt_in = excluded.marketing_opt_in,consent_text_version = excluded.consent_text_version$$,
  '42501',null,'PostgREST-style merge cannot update protected identity columns');
select lives_ok($$select public.save_shopper_consent('10000000-0000-0000-0000-000000000001',false,true,'choices')$$,'signed-in shopper can replace consent choices');
select ok((select not visible_to_shop and marketing_opt_in and consent_text_version = 'choices' and consented_at = now()
  from public.follows where organisation_id = '10000000-0000-0000-0000-000000000001'),'choices and consent time are saved');
select lives_ok($$select public.save_shopper_consent('10000000-0000-0000-0000-000000000002',true,false,'choices')$$,'signed-in shopper can first consent to another shop');
select ok((select not visible_to_shop and marketing_opt_in from public.follows where organisation_id = '10000000-0000-0000-0000-000000000001'),'second shop leaves first shop choices alone');
select lives_ok($$select public.save_shopper_consent('10000000-0000-0000-0000-000000000001',false,false,'choices')$$,'shopper can withdraw marketing independently');
select is((select count(*) from public.follows),2::bigint,'repeated consent does not duplicate follows');
select throws_ok($$select public.save_shopper_consent('10000000-0000-0000-0000-000000000001',true,false,'')$$,'23514','Complete consent choices required','empty consent text version refused');
select throws_ok($$select public.save_shopper_consent('10000000-0000-0000-0000-000000000001',null,false,'choices')$$,'23514','Complete consent choices required','missing choice refused');
reset role;
select is((select created_at from public.follows where shopper_id = tests.get_supabase_uid('signed_in_shopper') and organisation_id = '10000000-0000-0000-0000-000000000001'),now(),'original creation time survives repeated saves');
select is((select count(*) from public.follows where shopper_id = tests.get_supabase_uid('anonymous_shopper')),2::bigint,'signed-in consent does not write another shopper rows');
-- Simulate an earlier consent to distinguish unchanged choices from a fresh acknowledgement.
alter table public.follows disable trigger record_consent;
update public.follows set consented_at = now() - interval '1 day'
  where shopper_id = tests.get_supabase_uid('anonymous_shopper');
alter table public.follows enable trigger record_consent;
select tests.act_as('anonymous_shopper');
select lives_ok($$select public.save_shopper_consent('10000000-0000-0000-0000-000000000001',false,false,'fixture')$$,'anonymous shopper can repeat existing choices');
select is((select consented_at from public.follows where organisation_id = '10000000-0000-0000-0000-000000000001'),now() - interval '1 day','unchanged choices preserve consent time');
select lives_ok($$select public.save_shopper_consent('10000000-0000-0000-0000-000000000001',true,true,'new-version')$$,'anonymous shopper can change choices and version');
select is((select consented_at from public.follows where organisation_id = '10000000-0000-0000-0000-000000000001'),now(),'changed choices use transaction time');
select ok((select visible_to_shop and not marketing_opt_in and consent_text_version = 'fixture' from public.follows where organisation_id = '10000000-0000-0000-0000-000000000002'),'anonymous choices stay independent per shop');
select lives_ok($$delete from public.follows where organisation_id = '10000000-0000-0000-0000-000000000001'$$,'shopper can remove own follow');
select lives_ok($$select public.save_shopper_consent('10000000-0000-0000-0000-000000000001',false,true,'choices')$$,'anonymous shopper can first consent');
reset role;
update public.profiles set status = 'suspended' where id = tests.get_supabase_uid('signed_in_shopper');
select tests.act_as('signed_in_shopper');
select throws_ok($$select public.save_shopper_consent('10000000-0000-0000-0000-000000000001',true,true,'choices')$$,'42501','Active shopper required','suspended shopper cannot save consent');
reset role;
select finish();
