-- Fenced music result writes are atomic and backend-only.
select no_plan();
insert into public.music_tracks(id,provider,provider_track_id,title,duration_ms,licence_code)
values ('a9200000-0000-4000-8000-000000000001','jamendo','offline-worker','Offline worker',10000,'CC0');
insert into public.jobs(id,kind,payload,status,worker,attempts,lease_until)
values ('a9200000-0000-4000-8000-000000000002','music_analyse',
  '{"track_id":"a9200000-0000-4000-8000-000000000001"}','running','music-test',1,clock_timestamp() + interval '5 minutes');
select ok(not has_function_privilege('anon','public.install_music_result(uuid,text,smallint,text,jsonb,text,bigint,text,jsonb)','execute'),'Public cannot install music results');
select ok(not has_function_privilege('authenticated','public.install_music_result(uuid,text,smallint,text,jsonb,text,bigint,text,jsonb)','execute'),'Shoppers and staff cannot install music results');
select ok(has_function_privilege('service_role','public.install_music_result(uuid,text,smallint,text,jsonb,text,bigint,text,jsonb)','execute'),'Backend can install music results');
select throws_ok($$insert into public.jobs(kind,payload) values ('music_analyse',
  '{"track_id":"a9200000-0000-4000-8000-000000000001"}')$$,'23505',null,'Only one active job can analyse a shared track');
set local role service_role;
select lives_ok($$select public.install_music_result('a9200000-0000-4000-8000-000000000002','music-test',1::smallint,
  'test-librosa','{"duration_seconds":10,"tempo_bpm":120}',repeat('a',64),10,'audio/wav','[0.5]')$$,'Current attempt installs a result');
select is((select duration_ms from public.music_tracks where id = 'a9200000-0000-4000-8000-000000000001'),10000,'Duration converted to milliseconds');
select is((select bpm from public.music_tracks where id = 'a9200000-0000-4000-8000-000000000001'),120.0::numeric,'Tempo updated');
select is((select count(*) from public.music_analyses where track_id = 'a9200000-0000-4000-8000-000000000001'),1::bigint,'One shared analysis installed');
select lives_ok($$select public.install_music_result('a9200000-0000-4000-8000-000000000002','music-test',1::smallint,
  'test-librosa','{"duration_seconds":10,"tempo_bpm":120}',repeat('a',64),10,'audio/wav','[0.5]')$$,'Repeated installation reuses features');
select is((select count(*) from public.music_analyses where track_id = 'a9200000-0000-4000-8000-000000000001'),1::bigint,'Retry did not duplicate analysis');
select throws_ok($$select public.install_music_result('a9200000-0000-4000-8000-000000000002','other',1::smallint,
  'test-librosa','{"duration_seconds":10,"tempo_bpm":120}',repeat('b',64),10,'audio/wav','[0.9]')$$,'23514','Current music worker lease required','Wrong worker cannot replace metadata');
select throws_ok($$select public.install_music_result('a9200000-0000-4000-8000-000000000002','music-test',2::smallint,
  'test-librosa','{"duration_seconds":10,"tempo_bpm":120}',repeat('b',64),10,'audio/wav','[0.9]')$$,'23514','Current music worker lease required','Stale attempt cannot replace metadata');
select throws_ok($$select public.install_music_result('a9200000-0000-4000-8000-000000000002','music-test',1::smallint,
  'test-librosa','{"duration_seconds":0,"tempo_bpm":120}',repeat('b',64),10,'audio/wav','[0.9]')$$,'23514',null,'Invalid track facts roll back the result');
select is((select count(*) from public.music_analyses where track_id = 'a9200000-0000-4000-8000-000000000001'),1::bigint,'Failed metadata write rolled back analysis');
select is((select count(*) from public.media where bucket = 'audio' and path like 'a9200000-0000-4000-8000-000000000001/%'),1::bigint,'Failed metadata write rolled back media');
update public.jobs set lease_until = clock_timestamp() - interval '1 second' where id = 'a9200000-0000-4000-8000-000000000002';
select throws_ok($$select public.install_music_result('a9200000-0000-4000-8000-000000000002','music-test',1::smallint,
  'test-librosa','{"duration_seconds":10,"tempo_bpm":120}',repeat('b',64),10,'audio/wav','[0.9]')$$,'23514','Current music worker lease required','Expired worker cannot replace metadata');
reset role;
select * from finish();
