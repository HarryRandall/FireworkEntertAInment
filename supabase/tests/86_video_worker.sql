-- Measurement transitions retain the queue's exact lease fence and backend-only authority.
select no_plan();
insert into public.media(id,bucket,path,kind,mime,bytes,sha256)
values ('a9400000-0000-4000-8000-000000000001','imports','synthetic-video.mp4','video','video/mp4',1,repeat('a',64));
insert into public.video_analyses(id,media_id,extractor,priors)
values ('a9400000-0000-4000-8000-000000000002','a9400000-0000-4000-8000-000000000001','video-measure-1.0.0','{"shot_count":1}');
insert into public.jobs(id,kind,payload,status,worker,attempts,lease_until)
values ('a9400000-0000-4000-8000-000000000003','video_analyse',
  '{"media_id":"a9400000-0000-4000-8000-000000000001","analysis_id":"a9400000-0000-4000-8000-000000000002"}',
  'running','video-test',1,clock_timestamp() + interval '5 minutes');
select ok(not has_function_privilege('anon','public.save_video_measurement(uuid,text,smallint,text,text,jsonb,text)','execute'),'Public cannot save measurements');
select ok(not has_function_privilege('authenticated','public.save_video_measurement(uuid,text,smallint,text,text,jsonb,text)','execute'),'Browser roles cannot save measurements');
select ok(has_function_privilege('service_role','public.save_video_measurement(uuid,text,smallint,text,text,jsonb,text)','execute'),'Backend can save measurements');
select throws_ok($$insert into public.jobs(kind,payload) values ('video_analyse',
  '{"analysis_id":"a9400000-0000-4000-8000-000000000002"}')$$,'23505',null,'Duplicate active analysis jobs rejected');
set local role service_role;
select is((public.save_video_measurement('a9400000-0000-4000-8000-000000000003','video-test',1::smallint,'measuring','video-measure-1.0.0')).status,'measuring','Claimed worker starts measuring');
select throws_ok($$select public.save_video_measurement('a9400000-0000-4000-8000-000000000003','other',1::smallint,'failed','video-measure-1.0.0',null,'Error')$$,'23514','Current video worker lease required','Wrong worker rejected');
select throws_ok($$select public.save_video_measurement('a9400000-0000-4000-8000-000000000003','video-test',2::smallint,'failed','video-measure-1.0.0',null,'Error')$$,'23514','Current video worker lease required','Stale attempt rejected');
select throws_ok($$select public.save_video_measurement('a9400000-0000-4000-8000-000000000003','video-test',1::smallint,'interpreting','video-measure-1.0.0','{"shots":[],"features":[],"keyframes":[]}')$$,'23514','Evidence must cover every shot','Empty evidence rejected');
select throws_ok($$select public.save_video_measurement('a9400000-0000-4000-8000-000000000003','video-test',1::smallint,'interpreting','video-measure-1.0.0','{"shots":[{}],"features":[],"keyframes":[{}]}')$$,'23514','Evidence must cover every shot','Incomplete coverage rejected');
select is((select status from public.video_analyses where id='a9400000-0000-4000-8000-000000000002'),'measuring','Failed installation is atomic');
select is((public.save_video_measurement('a9400000-0000-4000-8000-000000000003','video-test',1::smallint,'failed','video-measure-1.0.0',null,'ValueError')).status,'failed','Safe failure visible');
select is((public.save_video_measurement('a9400000-0000-4000-8000-000000000003','video-test',1::smallint,'measuring','video-measure-1.0.0')).error,null,'Retry clears failure');
select is((public.save_video_measurement('a9400000-0000-4000-8000-000000000003','video-test',1::smallint,'interpreting','video-measure-1.0.0',
  '{"shots":[{"t_ms":500,"x":0.5}],"features":[{"life_ms":2000}],"keyframes":[{"peak":{"bucket":"imports","path":"video/test.png"}}]}')).status,'interpreting','All evidence installed for interpretation');
select is((public.save_video_measurement('a9400000-0000-4000-8000-000000000003','video-test',1::smallint,'measuring','video-measure-1.0.0')).status,'interpreting','Retry preserves installed evidence');
select throws_ok($$select public.save_video_measurement('a9400000-0000-4000-8000-000000000003','video-test',1::smallint,'failed','video-measure-1.0.0',null,'Error')$$,'23514','Installed video evidence is immutable to measurement','Late failure cannot erase evidence');
update public.jobs set payload=jsonb_set(payload,'{media_id}','"a9400000-0000-4000-8000-000000000004"') where id='a9400000-0000-4000-8000-000000000003';
select throws_ok($$select public.save_video_measurement('a9400000-0000-4000-8000-000000000003','video-test',1::smallint,'measuring','video-measure-1.0.0')$$,'23503','Matching video analysis required','Media identity mismatch rejected');
update public.jobs set payload=jsonb_set(payload,'{media_id}','"a9400000-0000-4000-8000-000000000001"'),lease_until=clock_timestamp()-interval '1 second' where id='a9400000-0000-4000-8000-000000000003';
select throws_ok($$select public.save_video_measurement('a9400000-0000-4000-8000-000000000003','video-test',1::smallint,'measuring','video-measure-1.0.0')$$,'23514','Current video worker lease required','Expired worker rejected');
reset role;
select * from finish();
