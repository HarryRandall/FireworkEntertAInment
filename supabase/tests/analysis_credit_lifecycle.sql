begin;

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('93000000-0000-4000-8000-000000000001', 'analysis-owner@example.test', now(), '{}'),
  ('93000000-0000-4000-8000-000000000002', 'analysis-other@example.test', now(), '{}');
insert into public.song_analyses (id, user_id, audio_path)
values ('93000000-0000-4000-8000-000000000003', '93000000-0000-4000-8000-000000000001', '93000000-0000-4000-8000-000000000001/example.mp3');

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '93000000-0000-4000-8000-000000000001';

do $$
declare
  result jsonb;
  token uuid;
  analysis_id uuid := '93000000-0000-4000-8000-000000000003';
  reservation text := 'music-analysis:93000000-0000-4000-8000-000000000003:reserve';
  starting_balance integer;
  cost integer;
begin
  select balance into starting_balance from public.ai_credit_accounts where user_id = auth.uid();
  select amount into cost from public.ai_credit_costs where key = 'music_analysis';
  if exists (select 1 from public.claim_song_analysis_attempt(analysis_id)) then
    raise exception 'Analysis was claimed without reserved credits';
  end if;
  result := public.reserve_ai_credits(auth.uid(), 'music_analysis', 99999, 'song_analyses', analysis_id, reservation);
  if (result->>'ok')::boolean is distinct from true then raise exception 'Credit reservation failed'; end if;
  result := public.reserve_ai_credits(auth.uid(), 'music_analysis', 99999, 'song_analyses', analysis_id, reservation);
  if (result->>'alreadyApplied')::boolean is distinct from true then raise exception 'Credit reservation was not idempotent'; end if;
  if not exists (select 1 from public.ai_credit_accounts where user_id = auth.uid() and reserved = cost) then
    raise exception 'Reservation did not use the server-owned credit price exactly once';
  end if;
  select lease_token into token from public.claim_song_analysis_attempt(analysis_id);
  if token is null then raise exception 'Owner could not claim funded analysis'; end if;
  if exists (select 1 from public.claim_song_analysis_attempt(analysis_id)) then
    raise exception 'A live analysis lease was claimed twice';
  end if;
  if public.fail_song_analysis_attempt(analysis_id, gen_random_uuid(), 'stale worker', 0) then
    raise exception 'Stale worker mutated analysis state';
  end if;
  perform set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000002', true);
  if public.fail_song_analysis_attempt(analysis_id, token, 'other user', 0) then
    raise exception 'Another user mutated the owner analysis';
  end if;
  perform set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000001', true);
  if not public.fail_song_analysis_attempt(analysis_id, token, 'bounded test failure', 1) then
    raise exception 'Owner could not terminate their claimed analysis';
  end if;
  if not exists (select 1 from public.song_analyses where id = analysis_id and status = 'failed' and lease_token is null) then
    raise exception 'Terminal analysis state did not clear its lease';
  end if;
  if not exists (select 1 from public.ai_credit_accounts where user_id = auth.uid() and balance = starting_balance and reserved = 0) then
    raise exception 'Failed analysis did not atomically refund reserved credits';
  end if;
  if public.fail_song_analysis_attempt(analysis_id, token, 'duplicate failure', 1) then
    raise exception 'An already completed lease was accepted again';
  end if;
end $$;
reset role;

rollback;
