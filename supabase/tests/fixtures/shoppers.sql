-- Synthetic shopper snapshots and music shared by two retailers; rollback-only fixtures.
create function tests.create_shoppers_fixture()
returns void language plpgsql set search_path = '' as $$
#variable_conflict error
begin
  perform tests.create_range_fixture();
  insert into public.plan_sessions(id,shopper_id,store_id,answers,solver,input_hash,age_confirmed_at) values
    ('a0000000-0000-0000-0000-000000000001',tests.get_supabase_uid('signed_in_shopper'),'90000000-0000-0000-0000-000000000001','{}','fixture','input-1',now()),
    ('a0000000-0000-0000-0000-000000000002',tests.get_supabase_uid('anonymous_shopper'),'90000000-0000-0000-0000-000000000002','{}','fixture','input-2',now());
  insert into public.plan_candidates(id,session_id,rank,cues,total_minor,currency,duration_ms) values
    ('a1000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001',1,tests.show_cues(),2500,'GBP',6000),
    ('a1000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000002',1,tests.show_cues(),2500,'GBP',6000);
  insert into public.plan_edits(session_id,candidate_id,seq,source,ops,outcome) values
    ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001',1,'chip','[]','applied'),
    ('a0000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000002',1,'rule','[]','clarify');
  insert into public.lists(id,shopper_id,store_id,plan_candidate_id,till_code,valid_until,status,redeemed_at) values
    ('a2000000-0000-0000-0000-000000000001',tests.get_supabase_uid('signed_in_shopper'),'90000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','1111111111111111',current_date + 1,'open',null),
    ('a2000000-0000-0000-0000-000000000002',tests.get_supabase_uid('anonymous_shopper'),'90000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000002','2222222222222222',current_date + 1,'open',null),
    ('a2000000-0000-0000-0000-000000000003',tests.get_supabase_uid('signed_in_shopper'),'90000000-0000-0000-0000-000000000001',null,'3333333333333333',current_date + 1,'redeemed',now()),
    ('a2000000-0000-0000-0000-000000000004',tests.get_supabase_uid('anonymous_shopper'),'90000000-0000-0000-0000-000000000002',null,'4444444444444444',current_date + 1,'redeemed',now());
  insert into public.list_items(list_id,product_id,quantity,unit_price_minor,currency)
    select id,'60000000-0000-0000-0000-000000000001',1,2500,'GBP' from public.lists;
  insert into public.follows(shopper_id,organisation_id,visible_to_shop,consent_text_version) values
    (tests.get_supabase_uid('signed_in_shopper'),'10000000-0000-0000-0000-000000000001',true,'fixture'),
    (tests.get_supabase_uid('anonymous_shopper'),'10000000-0000-0000-0000-000000000001',false,'fixture'),
    (tests.get_supabase_uid('anonymous_shopper'),'10000000-0000-0000-0000-000000000002',true,'fixture');
  insert into public.privacy_requests(shopper_id,kind) values
    (tests.get_supabase_uid('signed_in_shopper'),'export'),(tests.get_supabase_uid('anonymous_shopper'),'delete');
  insert into public.music_tracks(id,provider,provider_track_id,title,duration_ms,licence_code,status) values
    ('a3000000-0000-0000-0000-000000000001','jamendo','fixture-1','Published track',6000,'fixture','published'),
    ('a3000000-0000-0000-0000-000000000002','jamendo','fixture-2','Draft track',6000,'fixture','draft'),
    ('a3000000-0000-0000-0000-000000000003','jamendo','fixture-3','Withdrawn track',6000,'fixture','withdrawn');
  insert into public.music_analyses(id,track_id,algorithm,analysis,audio_sha256,is_current) values
    ('a4000000-0000-0000-0000-000000000001','a3000000-0000-0000-0000-000000000001','fixture','{}',repeat('a',64),true),
    ('a4000000-0000-0000-0000-000000000002','a3000000-0000-0000-0000-000000000002','fixture','{}',repeat('b',64),true),
    ('a4000000-0000-0000-0000-000000000003','a3000000-0000-0000-0000-000000000001','old','{}',repeat('c',64),false);
end;
$$;
comment on function tests.create_shoppers_fixture() is 'Creates owned plans, open and redeemed lists, visible and hidden consent and shared music for two organisations.';
