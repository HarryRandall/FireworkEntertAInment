-- Shared import retries, owned soundtrack mutations, analysis pins and credit invariants.
select no_plan();
select tests.create_operations_fixture();
create function tests.music_snapshot(p_track uuid default null,p_music jsonb default 'null') returns jsonb language sql stable as $$
  select jsonb_build_object('store_id','90000000-0000-0000-0000-000000000001',
    'answers',jsonb_build_object('budget_minor',3000,'soundtrack',p_track),
    'music',p_music,'age_confirmation',jsonb_build_object('confirmed_at',now()));
$$;
create function tests.music_candidate() returns jsonb language sql stable as $$
  select jsonb_build_object('rank',1,'name','Birthday soundtrack','mood','balanced','cues',tests.show_cues(),
    'total_minor',2500,'currency','GBP','duration_ms',6000,'scores','{}'::jsonb);
$$;
create function tests.import_music(p_shopper uuid default tests.get_supabase_uid('anonymous_shopper'),p_id text default '123')
returns uuid language sql as $$
  select public.import_shopper_track(p_shopper,'c0000000-0000-4000-8000-000000000001',
    jsonb_build_object('provider_track_id',p_id,'title','Synthetic track','artist','Synthetic artist','duration_ms',6000,
      'licence_code','CC-BY-4.0','licence_url','https://creativecommons.org/licenses/by/4.0/',
      'attribution','Synthetic track by Synthetic artist','audio_url','https://prod-1.storage.jamendo.com/audio'));
$$;
set local role service_role;
select public.persist_planner_result(tests.get_supabase_uid('anonymous_shopper'),
  'c0000000-0000-4000-8000-000000000001','90000000-0000-0000-0000-000000000001',
  tests.music_snapshot(),'silent','fixture',tests.music_candidate());
reset role;
select tests.act_as_public();
select throws_ok($$select tests.import_music()$$,'42501',null,'public cannot import provider data');
select throws_ok($$select public.plan_soundtrack('c0000000-0000-4000-8000-000000000001')$$,'42501',null,'public cannot inspect soundtrack sessions');
reset role;
select tests.act_as('anonymous_shopper');
select throws_ok($$select tests.import_music()$$,'42501',null,'shopper cannot supply provider metadata');
select throws_ok($$select public.persist_plan_music(null,null,null,0,'hash','{}','{}')$$,'42501',null,'shopper cannot author music solves');
reset role;
set local role service_role;
select throws_ok($$select tests.import_music(tests.get_supabase_uid('signed_in_shopper'))$$,'42501',null,'another shopper session cannot be imported into');
select lives_ok($$select tests.import_music()$$,'trusted import queues analysis');
select lives_ok($$select tests.import_music()$$,'repeat imports reuse identity and active job');
reset role;
select is((select count(*) from public.music_tracks where provider_track_id = '123'),1::bigint,'one shared track');
select is((select count(*) from public.jobs where kind = 'music_analyse' and payload->>'track_id' = (select id::text from public.music_tracks where provider_track_id = '123')),1::bigint,'one queued shared analysis');
select ok((select not commercial_use from public.music_tracks where provider_track_id = '123'),'commercial use remains false');
create function tests.write_music(p_revision int default 0,p_hash text default 'silent',p_next text default 'pending',
  p_analysis uuid default null,p_music jsonb default 'null',p_shopper uuid default tests.get_supabase_uid('anonymous_shopper'))
returns uuid language sql as $$
  select public.persist_plan_music(p_shopper,'c0000000-0000-4000-8000-000000000001',
    (select id from public.plan_candidates where session_id = 'c0000000-0000-4000-8000-000000000001'),p_revision,p_hash,
    tests.music_snapshot((select id from public.music_tracks where provider_track_id = '123'),p_music),tests.music_candidate(),
    (select id from public.music_tracks where provider_track_id = '123'),p_analysis,p_next);
$$;
set local role service_role;
select throws_ok($$select tests.write_music(p_shopper := tests.get_supabase_uid('signed_in_shopper'))$$,'42501',null,'service mutation still requires owned session');
select throws_ok($$select tests.write_music(p_revision := 1)$$,'40001',null,'stale displayed revision refused');
select throws_ok($$select tests.write_music(p_hash := 'wrong')$$,'40001',null,'stale input refused');
select throws_ok($$select tests.write_music(p_music := '{}')$$,'23514',null,'unidentified analysis refused');
select lives_ok($$select tests.write_music()$$,'pending soundtrack is planned without beats');
reset role;
select is((select revision from public.plan_candidates where session_id = 'c0000000-0000-4000-8000-000000000001'),1,'soundtrack update advances revision');
select tests.act_as('anonymous_shopper');
select is(public.plan_soundtrack('c0000000-0000-4000-8000-000000000001')->>'title','Synthetic track','owner reads pending attribution');
select is(public.plan_soundtrack('c0000000-0000-4000-8000-000000000001')->>'analysis_id',null::text,'pending track has no analysis');
reset role;
select tests.act_as('signed_in_shopper');
select is(public.plan_soundtrack('c0000000-0000-4000-8000-000000000001'),null::jsonb,'other shopper cannot read soundtrack');
reset role;
insert into public.music_analyses(id,track_id,algorithm,analysis,audio_sha256)
  select 'c4000000-0000-4000-8000-000000000001',id,'synthetic','{"tempo_bpm":120}',repeat('a',64)
  from public.music_tracks where provider_track_id = '123';
set local role service_role;
select lives_ok($$select tests.import_music()$$,'analysed import does not enqueue again');
select lives_ok($$select tests.write_music(1,'pending','timed','c4000000-0000-4000-8000-000000000001','{"tempo_bpm":120}')$$,'available analysis retimes and pins candidate');
reset role;
select is((select count(*) from public.jobs where kind = 'music_analyse' and payload->>'track_id' = (select id::text from public.music_tracks where provider_track_id = '123')),1::bigint,'current analysis suppresses enqueue');
select is((select soundtrack_analysis_id from public.plan_candidates where session_id = 'c0000000-0000-4000-8000-000000000001'),'c4000000-0000-4000-8000-000000000001'::uuid,'candidate pins exact analysis');
update public.music_analyses set is_current = false where id = 'c4000000-0000-4000-8000-000000000001';
insert into public.music_analyses(track_id,algorithm,analysis,audio_sha256)
  select id,'new-synthetic','{"tempo_bpm":90}',repeat('b',64) from public.music_tracks where provider_track_id = '123';
select tests.act_as('anonymous_shopper');
select is(public.plan_soundtrack('c0000000-0000-4000-8000-000000000001')->>'analysis_id','c4000000-0000-4000-8000-000000000001','reanalysis never moves pinned features');
reset role;
set local role service_role;
select lives_ok($$select public.persist_planner_result(tests.get_supabase_uid('anonymous_shopper'),
  'c0000000-0000-4000-8000-000000000001','90000000-0000-0000-0000-000000000001',
  tests.music_snapshot((select id from public.music_tracks where provider_track_id = '123'),' {"tempo_bpm":120}'),
  'timed','fixture',tests.music_candidate() || '{"rank":2}')$$,'alternatives retain selected music snapshot');
reset role;
select is((select soundtrack_analysis_id from public.plan_candidates where session_id = 'c0000000-0000-4000-8000-000000000001' and rank = 2),'c4000000-0000-4000-8000-000000000001'::uuid,'alternative copies exact pin');
select is((select count(*) from public.credit_ledger where ref_id = 'c0000000-0000-4000-8000-000000000001'),1::bigint,'all music changes and alternative cost no extra credit');
select throws_ok($$update public.plan_candidates set soundtrack_analysis_id = 'c4000000-0000-4000-8000-000000000001',soundtrack_track_id = null where session_id = 'c0000000-0000-4000-8000-000000000001'$$,'23514','Analysis must match plan soundtrack','mismatched track pin rejected');
-- The saved-show boundary and public playback retain historical audio and features.
insert into public.media(id,bucket,path,kind,mime,bytes,sha256)
  select 'c5000000-0000-4000-8000-000000000001','audio',id::text || '/' || repeat('a',64),'audio','audio/wav',1,repeat('a',64)
  from public.music_tracks where provider_track_id = '123';
insert into public.media(id,bucket,path,kind,mime,bytes,sha256)
  select 'c5000000-0000-4000-8000-000000000002','audio',id::text || '/' || repeat('b',64),'audio','audio/wav',1,repeat('b',64)
  from public.music_tracks where provider_track_id = '123';
update public.music_tracks set audio_media_id = 'c5000000-0000-4000-8000-000000000002' where provider_track_id = '123';
update public.shows set soundtrack_track_id = (select id from public.music_tracks where provider_track_id = '123')
  where id = '93000000-0000-0000-0000-000000000001';
select tests.act_as('organisation_owner');
select lives_ok($$select public.save_show('93000000-0000-0000-0000-000000000001',tests.show_cues(),6000,
  'c4000000-0000-4000-8000-000000000001',2000)$$,'saving a show pins historical track features and offset');
reset role;
select tests.act_as_public();
select is(public.show_soundtrack('90000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001')->>'analysis_id',
  'c4000000-0000-4000-8000-000000000001','visible saved show uses version pin');
select is(public.show_soundtrack('90000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001')->>'audio_media_id',
  'c5000000-0000-4000-8000-000000000001','saved playback uses audio matching pinned features');
select is(public.show_soundtrack('90000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001')->>'offset_ms','2000','saved offset retained');
select is(public.show_soundtrack('90000000-0000-0000-0000-000000000002','93000000-0000-0000-0000-000000000001'),null::jsonb,'foreign-store music hidden');
select throws_ok($$select public.music_track_analysis('c0000000-0000-4000-8000-000000000001',null)$$,'42501',null,'public cannot look up session analysis');
reset role;
select tests.act_as('anonymous_shopper');
select is(public.plan_soundtrack('c0000000-0000-4000-8000-000000000001')->>'audio_media_id',
  'c5000000-0000-4000-8000-000000000001','candidate playback uses historical analysed audio');
select ok(public.music_track_analysis('c0000000-0000-4000-8000-000000000001',
  (select id from public.music_tracks where provider_track_id = '123')) is not null,'owned session can select current features');
reset role;
select tests.act_as('signed_in_shopper');
select is(public.music_track_analysis('c0000000-0000-4000-8000-000000000001',
  (select id from public.music_tracks where provider_track_id = '123')),null::jsonb,'other shopper cannot look up session features');
reset role;
update public.music_tracks set status = 'withdrawn' where provider_track_id = '123';
set local role service_role;
select throws_ok($$select tests.import_music()$$,'23514','Track is unavailable','import never republishes a withdrawn track');
reset role;
select tests.act_as_public();
select is(public.show_soundtrack('90000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001'),null::jsonb,'withdrawn soundtrack hidden from public show');
reset role;
select * from finish();
