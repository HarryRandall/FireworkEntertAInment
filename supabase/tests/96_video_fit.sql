-- Fenced call budgets and atomic candidate lineage under real backend/browser privileges.
select plan(18);
-- Domain suites clear seeds, so install an independent published starting preset.
insert into public.effects(id,slug,name,family,kind,status,is_template) values
  ('96000000-0000-4000-8000-000000000004','peony','Fit starting preset','peony','shell','published',true);
insert into public.effect_versions(id,effect_id,number,design,renderer,status) values
  ('96000000-0000-4000-8000-000000000005','96000000-0000-4000-8000-000000000004',1,tests.design_fixture(),'1.0.0','published');
update public.effects set current_version_id = '96000000-0000-4000-8000-000000000005'
  where id = '96000000-0000-4000-8000-000000000004';
insert into public.media(id,bucket,path,kind,mime,bytes,sha256) values
  ('96000000-0000-4000-8000-000000000001','imports','fit-contract.mp4','video','video/mp4',100,repeat('a',64));
insert into public.video_analyses(id,media_id,extractor,status,shots,features) values
  ('96000000-0000-4000-8000-000000000002','96000000-0000-4000-8000-000000000001','video-measure-1.0.0','interpreting',
   '[{"t_ms":500,"x":0.5,"angle_deg":0}]','[{"shot_index":0}]');
insert into public.jobs(id,kind,payload,status,attempts,worker,lease_until) values
  ('96000000-0000-4000-8000-000000000003','video_fit',
   '{"analysis_id":"96000000-0000-4000-8000-000000000002","media_id":"96000000-0000-4000-8000-000000000001"}',
   'running',1,'fit-test',clock_timestamp() + interval '5 minutes');
select ok(not has_function_privilege('anon','public.video_fit_step(uuid,text,smallint,text,jsonb)','execute'),'public visitors cannot write fit results');
select ok(not has_function_privilege('authenticated','public.video_fit_step(uuid,text,smallint,text,jsonb)','execute'),'browser staff cannot reserve paid calls');
select ok(has_function_privilege('service_role','public.video_fit_step(uuid,text,smallint,text,jsonb)','execute'),'backend may use fenced fitting');
set local role service_role;
select throws_ok($sql$ select public.video_fit_step('96000000-0000-4000-8000-000000000003','stale',1::smallint,'read'); $sql$,
 '23514','Current fitting worker lease required','stale worker cannot read fitting state');
select throws_ok($sql$ select public.video_fit_step('96000000-0000-4000-8000-000000000003','fit-test',1::smallint,'reserve','{"model":"offline","cost_usd":0.11}'); $sql$,
 '23514','Unused interpretation budget required','over-budget call refused before reservation');
select lives_ok($sql$ select public.video_fit_step('96000000-0000-4000-8000-000000000003','fit-test',1::smallint,'reserve','{"model":"offline","cost_usd":0.01}'); $sql$,
 'service role reserves a single bounded call');
select throws_ok($sql$ select public.video_fit_step('96000000-0000-4000-8000-000000000003','fit-test',1::smallint,'reserve','{"model":"offline","cost_usd":0.01}'); $sql$,
 '23514','Unused interpretation budget required','uncertain generation cannot be repeated');
select lives_ok($sql$ select public.video_fit_step('96000000-0000-4000-8000-000000000003','fit-test',1::smallint,'usage',
 '{"tokens_in":1000,"tokens_out":100,"cost_usd":0.00014,"latency_ms":20}'); $sql$,'actual usage installed before parsing/candidates');
select throws_ok($sql$ select public.video_fit_step('96000000-0000-4000-8000-000000000003','fit-test',1::smallint,'interpret',
 '{"proposal":{"effects":{"a":{"template":"peony","overrides":{}}},"composition":{"tubes":[{"i":0,"letter":"a","t_ms":501,"angle_deg":0}]}},"scores":{},"overall":0.5,"renderer":"1.0.0"}'); $sql$,
 '23514','Candidate sequence must preserve measured onsets','model cannot rewrite measured timing');
select throws_ok($sql$ select public.video_fit_step('96000000-0000-4000-8000-000000000003','fit-test',1::smallint,'interpret',
 '{"proposal":{"effects":{"a":{"template":"invented","overrides":{}}},"composition":{"tubes":[{"i":0,"letter":"a","t_ms":500,"angle_deg":0}]}},"scores":{},"overall":0.5,"renderer":"1.0.0"}'); $sql$,
 '23514','Canonical template overrides required','unknown templates rejected transactionally');
select lives_ok($sql$ select public.video_fit_step('96000000-0000-4000-8000-000000000003','fit-test',1::smallint,'interpret',
 '{"proposal":{"effects":{"a":{"template":"peony","overrides":{}}},"composition":{"tubes":[{"i":0,"letter":"a","t_ms":500,"angle_deg":0}]}},"scores":{},"overall":0.5,"renderer":"1.0.0"}'); $sql$,'valid interpretation and fitting state installed together');
select is((select status from public.video_analyses where id = '96000000-0000-4000-8000-000000000002'),'fitting','analysis is fitting');
select is((select cost_usd from public.llm_calls where ref_id = '96000000-0000-4000-8000-000000000001'),0.00014::numeric,'call stores real token-based cost');
select lives_ok($sql$ select public.video_fit_step('96000000-0000-4000-8000-000000000003','fit-test',1::smallint,'ready',
 '{"proposal":{"effects":{"a":{"template":"peony","overrides":{}}},"composition":{"tubes":[{"i":0,"letter":"a","t_ms":500,"angle_deg":0}]}},"scores":{},"overall":0.8,"renderer":"1.0.0"}'); $sql$,'fit child and ready state installed atomically');
select is((select fit.parent_id from public.design_candidates as fit where fit.analysis_id = '96000000-0000-4000-8000-000000000002' and fit.source = 'fit'),
 (select llm.id from public.design_candidates as llm where llm.analysis_id = '96000000-0000-4000-8000-000000000002' and llm.source = 'llm'),'fit refers to its interpretation parent');
select lives_ok($sql$ select public.video_fit_step('96000000-0000-4000-8000-000000000003','fit-test',1::smallint,'ready','{}'); $sql$,'retry reuses installed fit');
select is((select count(*)::integer from public.design_candidates where analysis_id = '96000000-0000-4000-8000-000000000002'),2,'retry creates no duplicate candidates');
select public.video_fit_step('96000000-0000-4000-8000-000000000003','fit-test',1::smallint,'failure','{"error":"late"}');
select is((select status from public.video_analyses where id = '96000000-0000-4000-8000-000000000002'),'ready','late failure cannot regress ready analysis');
reset role;
select * from finish();
