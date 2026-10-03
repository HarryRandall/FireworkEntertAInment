-- Reviewed prompt metadata, system-owned call records and leased background work.
create table public.prompt_versions (
  key text not null, version integer not null check (version > 0), model text not null,
  status text not null check (status in ('live','test','retired')),
  traffic_pct smallint not null default 100 check (traffic_pct between 0 and 100),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (key,version)
);
comment on column public.prompt_versions.traffic_pct is 'Percentage of eligible calls routed to this prompt, from the prompt registry contract.';
create table public.llm_calls (
  id bigint generated always as identity primary key,
  purpose text not null, prompt_key text, prompt_version integer, model text not null, provider text,
  organisation_id uuid references public.organisations(id), plan_session_id uuid references public.plan_sessions(id) on delete set null,
  ref_id uuid, tokens_in integer check (tokens_in >= 0), tokens_out integer check (tokens_out >= 0),
  cost_usd numeric(10,6) check (cost_usd >= 0), latency_ms integer check (latency_ms >= 0),
  ok boolean not null, error text, at timestamptz not null default now(),
  foreign key (prompt_key,prompt_version) references public.prompt_versions(key,version) match full
);
comment on column public.llm_calls.cost_usd is 'Provider usage cost in US dollars, with microdollar precision; not a retailer invoice amount.';
create index llm_calls_organisation_idx on public.llm_calls(organisation_id);
create index llm_calls_session_idx on public.llm_calls(plan_session_id);
alter table public.plan_edits add constraint plan_edits_llm_call_fk foreign key (llm_call_id) references public.llm_calls(id);
create table public.jobs (
  id uuid primary key default gen_random_uuid(), kind text not null check (kind <> ''),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  status text not null default 'queued' check (status in ('queued','running','done','failed','dead')),
  priority smallint not null default 0, attempts smallint not null default 0 check (attempts >= 0),
  max_attempts smallint not null default 3 check (max_attempts > 0),
  run_after timestamptz not null default now(), lease_until timestamptz, worker text,
  result jsonb, error text, cost jsonb, organisation_id uuid references public.organisations(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (attempts <= max_attempts),
  check ((status = 'running') = (lease_until is not null and worker is not null))
);
comment on column public.jobs.max_attempts is 'Default three worker attempts per job, the queue contract retry budget.';
create index jobs_claim_idx on public.jobs(kind,status,run_after) where status in ('queued','running','failed');
create index jobs_organisation_idx on public.jobs(organisation_id);
create table public.rate_limit_buckets (
  key text primary key, tokens numeric not null check (tokens >= 0), refilled_at timestamptz not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create trigger prompt_versions_updated before update on public.prompt_versions for each row execute function private.set_updated_at();
create trigger jobs_updated before update on public.jobs for each row execute function private.set_updated_at();
create trigger rate_limit_buckets_updated before update on public.rate_limit_buckets for each row execute function private.set_updated_at();
alter table public.prompt_versions enable row level security;
alter table public.llm_calls enable row level security;
alter table public.jobs enable row level security;
alter table public.rate_limit_buckets enable row level security;
create policy prompt_versions_read on public.prompt_versions for select to authenticated using ((select private.staff_role()) is not null);
create policy llm_calls_read on public.llm_calls for select to authenticated using ((select private.staff_role()) is not null);
create policy jobs_read on public.jobs for select to authenticated using ((select private.staff_role()) is not null);

-- Row locking makes refill and consumption one operation; callers supply a trusted budget.
create function private.consume_rate_limit(p_key text,p_capacity numeric,p_refill_per_second numeric,p_cost numeric default 1)
returns boolean language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  v_bucket public.rate_limit_buckets;
  v_now timestamptz := clock_timestamp();
  v_tokens numeric;
begin
  if p_key is null or p_key = '' or p_capacity is null or p_capacity <= 0
    or p_refill_per_second is null or p_refill_per_second <= 0 or p_cost is null or p_cost <= 0 or p_cost > p_capacity then
    raise exception using errcode = '23514', message = 'Valid token bucket budget required';
  end if;
  insert into public.rate_limit_buckets(key,tokens,refilled_at) values (p_key,p_capacity,v_now) on conflict (key) do nothing;
  select bucket.* into v_bucket from public.rate_limit_buckets as bucket where bucket.key = p_key for update;
  v_now := clock_timestamp();
  -- Elapsed seconds earn fractional tokens; cap idle accumulation at the burst budget.
  v_tokens := least(p_capacity,v_bucket.tokens + greatest(0,extract(epoch from v_now - v_bucket.refilled_at)) * p_refill_per_second);
  update public.rate_limit_buckets as bucket set tokens = v_tokens - case when v_tokens >= p_cost then p_cost else 0 end,
    refilled_at = v_now where bucket.key = p_key;
  return v_tokens >= p_cost;
end;
$$;
comment on function private.consume_rate_limit(text,numeric,numeric,numeric) is 'Atomically consumes tokens from a trusted keyed budget, refilling in tokens per elapsed wall-clock second; returns false when exhausted.';

create function private.claim_job(p_kinds text[],p_worker text)
returns public.jobs language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  -- Five minutes is the initial queue lease budget; long workers renew before expiry.
  v_lease constant interval := interval '5 minutes';
  v_job public.jobs;
begin
  if p_worker is null or btrim(p_worker) = '' or coalesce(cardinality(p_kinds),0) = 0 then
    raise exception using errcode = '23514', message = 'Worker identity and job kinds required';
  end if;
  -- Exhausted crashed workers are terminal, rather than stranded as running jobs.
  update public.jobs as job set status = 'dead', worker = null, lease_until = null,
    error = coalesce(job.error,'Worker lease expired')
    where job.kind = any(p_kinds) and job.status = 'running' and job.lease_until <= clock_timestamp() and job.attempts >= job.max_attempts;
  select job.* into v_job from public.jobs as job
    where job.kind = any(p_kinds) and job.attempts < job.max_attempts and (
      (job.status in ('queued','failed') and job.run_after <= clock_timestamp())
      or (job.status = 'running' and job.lease_until <= clock_timestamp()))
    order by job.priority desc,job.run_after,job.id for update skip locked limit 1;
  if v_job.id is null then return null; end if;
  update public.jobs as job set status = 'running', attempts = job.attempts + 1,
    worker = p_worker, lease_until = clock_timestamp() + v_lease, error = null
    where job.id = v_job.id returning job.* into v_job;
  return v_job;
end;
$$;
comment on function private.claim_job(text[],text) is 'Claims one due job with SKIP LOCKED, increments attempts and issues a five-minute wall-clock lease; returns null when none is available.';
create function public.claim_job(kinds text[],worker text)
returns public.jobs language plpgsql set search_path = '' as $$
#variable_conflict error
begin
  return private.claim_job(kinds,worker);
end;
$$;
comment on function public.claim_job(text[],text) is 'Returns one exclusively leased job for a trusted worker, or null when no requested kind is due.';

-- Attempt number fences a reclaimed lease even when the worker name is reused.
create function private.finish_job(p_id uuid,p_worker text,p_attempt smallint,p_result jsonb,p_error text,p_cost jsonb)
returns void language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  -- Retry delay starts at 30 seconds and doubles per failed attempt, capped at one hour.
  v_backoff_seconds constant integer := 30;
  v_backoff_cap_seconds constant integer := 3600;
  v_job public.jobs;
begin
  select job.* into v_job from public.jobs as job where job.id = p_id for update;
  if v_job.id is null or v_job.status <> 'running' or v_job.worker is distinct from p_worker
    or v_job.attempts is distinct from p_attempt or v_job.lease_until <= clock_timestamp() then
    raise exception using errcode = '23514', message = 'Current worker lease required';
  end if;
  update public.jobs as job set
    status = case when p_error is null then 'done' when job.attempts >= job.max_attempts then 'dead' else 'failed' end,
    result = p_result,error = p_error,cost = p_cost,worker = null,lease_until = null,
    run_after = case when p_error is null then job.run_after else clock_timestamp()
      + make_interval(secs => least(v_backoff_cap_seconds,v_backoff_seconds * power(2::numeric,job.attempts - 1))::double precision) end
    where job.id = p_id;
end;
$$;
comment on function private.finish_job(uuid,text,smallint,jsonb,text,jsonb) is 'Completes or fails the current fenced lease atomically, scheduling exponential retry delay in seconds or marking the exhausted job dead.';
create function public.complete_job(id uuid,worker text,attempt smallint,result jsonb default null,cost jsonb default null)
returns void language plpgsql set search_path = '' as $$
#variable_conflict error
begin
  perform private.finish_job(id,worker,attempt,result,null,cost);
end;
$$;
comment on function public.complete_job(uuid,text,smallint,jsonb,jsonb) is 'Records a trusted worker result only for its unexpired matching lease and attempt.';
create function public.fail_job(id uuid,worker text,attempt smallint,failure_reason text,cost jsonb default null)
returns void language plpgsql set search_path = '' as $$
#variable_conflict error
begin
  if failure_reason is null or failure_reason = '' then raise exception using errcode = '23514',message = 'Failure reason required'; end if;
  perform private.finish_job(id,worker,attempt,null,failure_reason,cost);
end;
$$;
comment on function public.fail_job(uuid,text,smallint,text,jsonb) is 'Records a non-empty worker failure and retries with backoff until the attempt budget is exhausted.';
create function private.renew_job_lease(p_id uuid,p_worker text,p_attempt smallint)
returns timestamptz language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  v_until timestamptz;
  -- Same five-minute queue lease budget as initial claim.
  v_lease constant interval := interval '5 minutes';
begin
  update public.jobs as job set lease_until = clock_timestamp() + v_lease
    where job.id = p_id and job.status = 'running' and job.worker = p_worker and job.attempts = p_attempt
      and job.lease_until > clock_timestamp() returning lease_until into v_until;
  if v_until is null then raise exception using errcode = '23514',message = 'Current worker lease required'; end if;
  return v_until;
end;
$$;
comment on function private.renew_job_lease(uuid,text,smallint) is 'Extends an unexpired fenced lease by the five-minute worker budget and returns its wall-clock expiry.';
create function public.renew_job_lease(id uuid,worker text,attempt smallint)
returns timestamptz language plpgsql set search_path = '' as $$
#variable_conflict error
begin
  return private.renew_job_lease(id,worker,attempt);
end;
$$;
comment on function public.renew_job_lease(uuid,text,smallint) is 'Renews the current trusted worker attempt and returns its lease expiry.';

-- One active analysis per shared track prevents duplicate workers and provider fetches.
create unique index music_jobs_active_track_idx on public.jobs (((payload->>'track_id')::uuid))
  where kind = 'music_analyse' and status in ('queued','running','failed');

-- Install audio metadata and shared features under the same fenced queue attempt.
create function private.install_music_result(p_job uuid,p_worker text,p_attempt smallint,
  p_algorithm text,p_analysis jsonb,p_audio_sha256 text,p_bytes bigint,p_mime text,p_waveform jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  v_job public.jobs;
  v_track uuid;
  v_media uuid;
  v_analysis uuid;
  v_path text;
  -- Stored track durations use integer milliseconds; analysis clocks use seconds.
  v_ms_per_second constant integer := 1000;
  v_duration integer := round((p_analysis->>'duration_seconds')::numeric * v_ms_per_second);
begin
  select job.* into v_job from public.jobs as job where job.id = p_job for update;
  if v_job.id is null or v_job.kind <> 'music_analyse' or v_job.status <> 'running'
    or v_job.worker is distinct from p_worker or v_job.attempts is distinct from p_attempt
    or v_job.lease_until <= clock_timestamp() then
    raise exception using errcode = '23514', message = 'Current music worker lease required';
  end if;
  v_track := (v_job.payload->>'track_id')::uuid;
  perform track.id from public.music_tracks as track where track.id = v_track and track.provider = 'jamendo' for update;
  if not found then raise exception using errcode = '23503', message = 'Jamendo track required'; end if;
  -- A blocked track lock may outlive the lease checked before acquiring it.
  if v_job.lease_until <= clock_timestamp() then
    raise exception using errcode = '23514', message = 'Current music worker lease required';
  end if;
  v_path := v_track::text || '/' || p_audio_sha256;
  insert into public.media(bucket,path,kind,mime,bytes,sha256,duration_ms)
    values ('audio',v_path,'audio',p_mime,p_bytes,p_audio_sha256,v_duration)
    on conflict (bucket,path) do update set duration_ms = excluded.duration_ms
    returning id into v_media;
  v_analysis := private.save_music_analysis(v_track,p_algorithm,p_analysis,p_audio_sha256);
  update public.music_tracks set audio_media_id = v_media,duration_ms = v_duration,
    bpm = (p_analysis->>'tempo_bpm')::numeric,waveform = p_waveform where id = v_track;
  return v_analysis;
end;
$$;
comment on function private.install_music_result(uuid,text,smallint,text,jsonb,text,bigint,text,jsonb) is 'Atomically installs content-addressed audio metadata, immutable shared analysis and track display facts for the current music job attempt; returns the analysis UUID.';
create function public.install_music_result(p_job uuid,p_worker text,p_attempt smallint,
  p_algorithm text,p_analysis jsonb,p_audio_sha256 text,p_bytes bigint,p_mime text,p_waveform jsonb)
returns uuid language plpgsql set search_path = '' as $$
begin
  -- Keep the public privilege boundary explicit rather than using SQL inlining.
  return private.install_music_result(p_job,p_worker,p_attempt,p_algorithm,p_analysis,p_audio_sha256,p_bytes,p_mime,p_waveform);
end;
$$;
comment on function public.install_music_result(uuid,text,smallint,text,jsonb,text,bigint,text,jsonb) is 'Backend-only fenced music result installation; analysis times are seconds and waveform peaks are normalised amplitudes.';

-- One active measurement job per analysis prevents conflicting attempts for the same evidence.
create unique index video_jobs_active_analysis_idx on public.jobs (((payload->>'analysis_id')::uuid))
  where kind = 'video_analyse' and status in ('queued','running','failed');

-- Queue and analysis locks fence status/result installation, including reclaimed attempts.
create function private.save_video_measurement(p_job uuid,p_worker text,p_attempt smallint,
  p_state text,p_extractor text,p_measurements jsonb default null,p_error text default null)
returns public.video_analyses language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  v_job public.jobs;
  v_analysis public.video_analyses;
begin
  select job.* into v_job from public.jobs as job where job.id = p_job for update;
  if v_job.id is null or v_job.kind <> 'video_analyse' or v_job.status <> 'running'
    or v_job.worker is distinct from p_worker or v_job.attempts is distinct from p_attempt
    or v_job.lease_until <= clock_timestamp() then
    raise exception using errcode = '23514', message = 'Current video worker lease required';
  end if;
  select analysis.* into v_analysis from public.video_analyses as analysis
    where analysis.id = (v_job.payload->>'analysis_id')::uuid
      and analysis.media_id = (v_job.payload->>'media_id')::uuid for update;
  if v_analysis.id is null then
    raise exception using errcode = '23503', message = 'Matching video analysis required';
  end if;
  if v_job.lease_until <= clock_timestamp() then
    raise exception using errcode = '23514', message = 'Current video worker lease required';
  end if;
  if p_state not in ('measuring','interpreting','failed') or p_state is null
    or nullif(btrim(p_extractor),'') is null then
    raise exception using errcode = '23514', message = 'Measurement state and extractor required';
  end if;
  -- A retry after evidence installation must not regress interpretation or reviewed results.
  if v_analysis.status in ('interpreting','fitting','ready') or v_analysis.shots is not null then
    if p_state = 'measuring' and v_analysis.extractor = p_extractor then return v_analysis; end if;
    raise exception using errcode = '23514', message = 'Installed video evidence is immutable to measurement';
  end if;
  if p_state = 'interpreting' then
    if v_analysis.status <> 'measuring'
      or jsonb_typeof(p_measurements->'shots') is distinct from 'array'
      or jsonb_typeof(p_measurements->'features') is distinct from 'array'
      or jsonb_typeof(p_measurements->'keyframes') is distinct from 'array' then
      raise exception using errcode = '23514', message = 'Complete measured evidence required';
    end if;
    if jsonb_array_length(p_measurements->'shots') = 0
      or jsonb_array_length(p_measurements->'shots') <> jsonb_array_length(p_measurements->'features')
      or jsonb_array_length(p_measurements->'shots') <> jsonb_array_length(p_measurements->'keyframes') then
      raise exception using errcode = '23514', message = 'Evidence must cover every shot';
    end if;
  elsif p_state = 'failed' and nullif(btrim(p_error),'') is null then
    raise exception using errcode = '23514', message = 'Safe measurement error required';
  end if;
  update public.video_analyses as analysis set status = p_state, extractor = p_extractor,
    shots = case when p_state = 'interpreting' then p_measurements->'shots' else null end,
    features = case when p_state = 'interpreting' then p_measurements->'features' else null end,
    keyframes = case when p_state = 'interpreting' then p_measurements->'keyframes' else null end,
    error = case when p_state = 'failed' then p_error else null end
    where analysis.id = v_analysis.id returning analysis.* into v_analysis;
  if p_state = 'interpreting' then
    insert into public.jobs(kind,payload,organisation_id)
      values ('video_fit',jsonb_build_object('analysis_id',v_analysis.id,'media_id',v_analysis.media_id),v_job.organisation_id);
  end if;
  return v_analysis;
end;
$$;
comment on function private.save_video_measurement(uuid,text,smallint,text,text,jsonb,text) is 'Fences analysis state and complete shot evidence to the matching unexpired video job attempt. Times are ms from MP4 start; geometry is normalised image space. Returns the analysis row and preserves installed evidence on retries.';
create function public.save_video_measurement(p_job uuid,p_worker text,p_attempt smallint,
  p_state text,p_extractor text,p_measurements jsonb default null,p_error text default null)
returns public.video_analyses language plpgsql set search_path = '' as $$
begin
  return private.save_video_measurement(p_job,p_worker,p_attempt,p_state,p_extractor,p_measurements,p_error);
end;
$$;
comment on function public.save_video_measurement(uuid,text,smallint,text,text,jsonb,text) is 'Backend-only status and result write for one video measurement attempt; returns durable evidence for interpretation without completing the queue job.';

-- One generation per source media, including uncertain calls: retries cannot buy another response.
create unique index video_interpret_once_idx on public.llm_calls(ref_id)
  where purpose = 'video.interpret';
create unique index video_fit_active_analysis_idx on public.jobs (((payload->>'analysis_id')::uuid))
  where kind = 'video_fit' and status in ('queued','running','failed');

-- Queue and analysis locks serialize reservations, usage and immutable candidate installation.
create function private.video_fit_step(p_job uuid,p_worker text,p_attempt smallint,p_action text,p_record jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  -- Owner's per-video interpretation ceiling in USD, independent of changing model tariffs.
  v_cap_usd constant numeric := 0.10;
  v_job public.jobs;
  v_analysis public.video_analyses;
  v_call public.llm_calls;
  v_parent uuid;
  v_candidate public.design_candidates;
  v_source text;
  v_effect record;
  v_design jsonb;
begin
  select job.* into v_job from public.jobs as job where job.id = p_job for update;
  if v_job.id is null or v_job.kind <> 'video_fit' or v_job.status <> 'running'
    or v_job.worker is distinct from p_worker or v_job.attempts is distinct from p_attempt
    or v_job.lease_until <= clock_timestamp() then
    raise exception using errcode = '23514', message = 'Current fitting worker lease required';
  end if;
  select analysis.* into v_analysis from public.video_analyses as analysis
    where analysis.id = (v_job.payload->>'analysis_id')::uuid
      and analysis.media_id = (v_job.payload->>'media_id')::uuid for update;
  if v_analysis.id is null or v_analysis.shots is null or v_analysis.features is null then
    raise exception using errcode = '23514', message = 'Complete measured video required';
  end if;
  if v_job.lease_until <= clock_timestamp() then
    raise exception using errcode = '23514', message = 'Current fitting worker lease required';
  end if;
  select call.* into v_call from public.llm_calls as call
    where call.purpose = 'video.interpret' and call.ref_id = v_analysis.media_id;
  if p_action = 'read' then
    return jsonb_build_object('analysis',to_jsonb(v_analysis),'call',case when v_call.id is null then null else to_jsonb(v_call) end,
      'candidates',coalesce((select jsonb_agg(to_jsonb(candidate) order by candidate.source)
        from public.design_candidates as candidate where candidate.analysis_id = v_analysis.id and candidate.source in ('llm','fit') and candidate.model = v_call.model),'[]'::jsonb));
  elsif p_action = 'reserve' then
    if v_analysis.status not in ('interpreting','failed') or v_call.id is not null
      or (p_record->>'cost_usd')::numeric not between 0 and v_cap_usd
      or p_record->>'cost_usd' is null or nullif(p_record->>'model','') is null then
      raise exception using errcode = '23514', message = 'Unused interpretation budget required';
    end if;
    -- A pending row retains the whole estimate if a response or usage write is lost.
    insert into public.llm_calls(purpose,model,provider,ref_id,cost_usd,ok,error)
      values ('video.interpret',p_record->>'model','google',v_analysis.media_id,(p_record->>'cost_usd')::numeric,false,'reserved')
      returning * into v_call;
    return to_jsonb(v_call);
  elsif p_action = 'usage' then
    if v_call.id is null or v_call.error is distinct from 'reserved'
      or p_record->>'tokens_in' is null or p_record->>'tokens_out' is null
      or p_record->>'cost_usd' is null or p_record->>'latency_ms' is null then
      raise exception using errcode = '23514', message = 'Pending interpretation call required';
    end if;
    update public.llm_calls set tokens_in = (p_record->>'tokens_in')::integer,
      tokens_out = (p_record->>'tokens_out')::integer, cost_usd = (p_record->>'cost_usd')::numeric,
      latency_ms = (p_record->>'latency_ms')::integer,ok = false,error = 'response_received'
      where id = v_call.id returning * into v_call;
    return to_jsonb(v_call);
  elsif p_action in ('interpret','ready') then
    v_source := case when p_action = 'interpret' then 'llm' else 'fit' end;
    select candidate.* into v_candidate from public.design_candidates as candidate
      where candidate.analysis_id = v_analysis.id and candidate.source = v_source and candidate.model = v_call.model;
    if v_candidate.id is not null then return to_jsonb(v_candidate); end if;
    if p_action = 'interpret' and (v_analysis.status not in ('interpreting','failed') or v_call.error is distinct from 'response_received'
      or v_call.cost_usd > v_cap_usd or v_call.tokens_in is null or v_call.tokens_out is null) then
      raise exception using errcode = '23514', message = 'Successful bounded interpretation usage required';
    end if;
    if p_action = 'ready' then
      select candidate.id into v_parent from public.design_candidates as candidate
        where candidate.analysis_id = v_analysis.id and candidate.source = 'llm' and candidate.model = v_call.model;
      if v_analysis.status not in ('fitting','failed') or v_parent is null then
        raise exception using errcode = '23514', message = 'Interpretation parent required';
      end if;
    end if;
    perform private.check_candidate_proposal(p_record->'proposal','cake');
    if jsonb_array_length(p_record#>'{proposal,composition,tubes}') <> jsonb_array_length(v_analysis.shots) then
      raise exception using errcode = '23514', message = 'Candidate must cover all measured shots';
    end if;
    if exists (select from jsonb_array_elements(p_record#>'{proposal,composition,tubes}') with ordinality as tube(value,position)
      where (tube.value->>'i')::integer <> tube.position - 1
      or tube.value->'t_ms' is distinct from v_analysis.shots->(tube.position::integer - 1)->'t_ms') then
      raise exception using errcode = '23514', message = 'Candidate sequence must preserve measured onsets';
    end if;
    for v_effect in select * from jsonb_each(p_record#>'{proposal,effects}') loop
      select private.merge_design_overrides(version.design,coalesce(v_effect.value->'overrides','{}'::jsonb)) into v_design
        from public.effects as effect join public.effect_versions as version on version.id = effect.current_version_id
        where effect.slug = v_effect.value->>'template' and effect.is_template and effect.status = 'published'
          and version.status = 'published' and effect.kind = coalesce(v_effect.value#>>'{overrides,kind}',effect.kind);
      if v_design is null or not extensions.jsonb_matches_schema(private.design_schema(),v_design) then
        raise exception using errcode = '23514', message = 'Canonical template overrides required';
      end if;
    end loop;
    insert into public.design_candidates(analysis_id,source,model,parent_id,proposal,scores,overall,renderer)
      values (v_analysis.id,v_source,v_call.model,v_parent,p_record->'proposal',p_record->'scores',
        (p_record->>'overall')::numeric,p_record->>'renderer') returning * into v_candidate;
    update public.video_analyses set status = case when p_action = 'interpret' then 'fitting' else 'ready' end,
      error = null where id = v_analysis.id;
    if p_action = 'interpret' then
      update public.llm_calls set ok = true,error = null where id = v_call.id;
    end if;
    return to_jsonb(v_candidate);
  elsif p_action = 'failure' then
    if v_analysis.status <> 'ready' then
      update public.video_analyses set status = 'failed',error = p_record->>'error' where id = v_analysis.id;
      update public.llm_calls set ok = false,error = p_record->>'error'
        where id = v_call.id and not ok;
    end if;
    return '{}'::jsonb;
  end if;
  raise exception using errcode = '23514', message = 'Known fitting action required';
end;
$$;
comment on function private.video_fit_step(uuid,text,smallint,text,jsonb) is 'Fenced per-video call reservation, usage and immutable llm/fit candidate writes. Costs are USD; pending calls prevent repeat generation after uncertain failures. Returns durable state or installed rows.';
create function public.video_fit_step(p_job uuid,p_worker text,p_attempt smallint,p_action text,p_record jsonb default '{}')
returns jsonb language plpgsql set search_path = '' as $$
begin
  return private.video_fit_step(p_job,p_worker,p_attempt,p_action,p_record);
end;
$$;
comment on function public.video_fit_step(uuid,text,smallint,text,jsonb) is 'Backend-only fitting lifecycle for an unexpired matching queue attempt; preserves measured evidence and ready results.';

-- Fixed annual windows are evaluated in the shop's local calendar. Unknown feast rules fail closed.
create function private.planner_sale_open(p_store uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select store.licence = 'all_year' or exists (
    select from public.sale_periods as period
    where period.market = store.market and (period.region is null or period.region = store.region)
      and period.rule->>'type' = 'fixed'
      and case when period.rule->>'from' <= period.rule->>'to'
        then to_char(now() at time zone store.timezone,'MM-DD') between period.rule->>'from' and period.rule->>'to'
        else to_char(now() at time zone store.timezone,'MM-DD') >= period.rule->>'from'
          or to_char(now() at time zone store.timezone,'MM-DD') <= period.rule->>'to' end)
  from public.stores as store join public.markets as market on market.code = store.market
  where store.id = p_store;
$$;
comment on function private.planner_sale_open(uuid) is 'Checks an all-year store licence or a fixed annual sale window in store time; unsupported feast calendars remain closed.';

create function private.planner_context(p_store uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'market',jsonb_build_object('code',market.code,'currency',market.currency,'min_age',market.min_age,'enabled',market.enabled),
    'sale',jsonb_build_object('open',private.planner_sale_open(store.id),'evaluated_at',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
    'bands',(select jsonb_agg(jsonb_build_object('market',band.market,'band',band.band,
      'max_distance_m',band.max_distance_m,'allowed_categories',band.allowed_categories))
      from public.safety_bands as band where band.market = market.code),
    'products',coalesce((select jsonb_agg(jsonb_build_object(
      'product_id',product.id,'store_id',store.id,'current_version_id',product.current_version_id,
      'status',product.status,'kind',product.kind,'price_minor',visible.price_minor,'currency',visible.currency,
      'stock_qty',visible.stock_qty,'hidden',false,'min_safety_distance_m',product.min_safety_distance_m,
      'noise_level',product.noise_level,'safety_confirmed',product.safety_confirmed_at is not null,
      'has_bangs',product.has_bangs,'has_crackle',product.has_crackle,'has_whistle',product.has_whistle,
      'duration_ms',product.duration_ms,'energy',product.energy,'colours',product.colours,'tags',product.tags,
      'product_market',jsonb_build_object('market',listing.market,'allowed',listing.allowed,
        'legal_category',listing.legal_category,'min_age',listing.min_age,'confirmed',listing.confirmed_at is not null)))
      from private.shopper_store_products(store.id) as visible
      join public.products as product on product.id = visible.product_id
      join public.product_markets as listing on listing.product_id = product.id and listing.market = market.code),'[]'::jsonb))
  from public.stores as store join public.markets as market on market.code = store.market
  where store.id = p_store and private.store_page(store.id) is not null;
$$;
comment on function private.planner_context(uuid) is 'Reads public solver facts, current sale eligibility and market garden bands for a visible store; excludes billing and private retailer facts.';
create function public.planner_context(p_store uuid)
returns jsonb language sql stable set search_path = '' as $$ select private.planner_context(p_store); $$;
comment on function public.planner_context(uuid) is 'Returns the restricted public planner input slice for one open store.';

-- Only the trusted solver boundary may author money, clocks and candidates.
create function private.persist_planner_result(p_shopper uuid,p_session uuid,p_store uuid,p_snapshot jsonb,
  p_hash text,p_solver text,p_candidate jsonb,p_qr uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  -- Product choice: three starts per hour, alternatives burst six and refill once per minute.
  v_start_capacity constant int := 3;
  v_start_refill_seconds constant int := 1200;
  v_alternative_capacity constant int := 6;
  v_alternative_refill_seconds constant int := 60;
  v_existing public.plan_sessions;
  v_candidate uuid;
  v_rank int := (p_candidate->>'rank')::int;
  v_organisation uuid;
begin
  if not exists (select from public.profiles as profile where profile.id = p_shopper and profile.status = 'active') then
    raise exception using errcode = '42501',message = 'Active shopper required';
  end if;
  -- Serialise retries of the same request before looking for its session.
  perform pg_advisory_xact_lock(hashtextextended(p_session::text,0));
  select session.* into v_existing from public.plan_sessions as session where session.id = p_session for update;
  if v_existing.id is not null then
    if v_existing.shopper_id <> p_shopper or v_existing.store_id <> p_store
      or v_existing.input_hash <> p_hash or v_existing.solver <> p_solver or (v_rank > 1 and v_existing.solver_snapshot is distinct from p_snapshot) then
      raise exception using errcode = '42501',message = 'Session snapshot mismatch';
    end if;
    select candidate.id into v_candidate from public.plan_candidates as candidate
      where candidate.session_id = p_session and candidate.rank = v_rank;
    if v_candidate is not null then return v_candidate; end if;
    if v_rank <> (select coalesce(max(candidate.rank),0) + 1 from public.plan_candidates as candidate where candidate.session_id = p_session) then
      raise exception using errcode = '23514',message = 'Next candidate rank required';
    end if;
    if not private.consume_rate_limit('planner:alternative:' || p_shopper,v_alternative_capacity,1.0 / v_alternative_refill_seconds) then
      raise exception using errcode = 'P0001',message = 'Planner rate limit reached';
    end if;
  else
    select store.organisation_id into v_organisation from public.stores as store where store.id = p_store;
    if private.store_page(p_store) is null or not private.planner_sale_open(p_store) or v_rank <> 1
      or p_snapshot->'age_confirmation'->>'confirmed_at' is null
      or (p_snapshot->'age_confirmation'->>'confirmed_at')::timestamptz > now()
      or (p_qr is not null and not exists (select from public.qr_codes as code
        where code.id = p_qr and code.organisation_id = v_organisation
          and (code.store_id is null or code.store_id = p_store) and code.status = 'live')) then
      raise exception using errcode = '23514',message = 'Eligible store, age and QR required';
    end if;
    if not private.consume_rate_limit('planner:start:' || p_shopper,v_start_capacity,1.0 / v_start_refill_seconds) then
      raise exception using errcode = 'P0001',message = 'Planner rate limit reached';
    end if;
    insert into public.plan_sessions(id,shopper_id,store_id,qr_code_id,answers,age_confirmed_at,solver,input_hash,solver_snapshot)
      values (p_session,p_shopper,p_store,p_qr,p_snapshot->'answers',
        (p_snapshot->'age_confirmation'->>'confirmed_at')::timestamptz,p_solver,p_hash,p_snapshot);
    perform private.charge_plan_session(p_session);
  end if;
  insert into public.plan_candidates(session_id,rank,mood,cues,total_minor,currency,duration_ms,scores,picked_at)
    values (p_session,v_rank,p_candidate->>'mood',p_candidate->'cues',(p_candidate->>'total_minor')::bigint,
      p_candidate->>'currency',(p_candidate->>'duration_ms')::int,p_candidate->'scores',clock_timestamp()) returning id into v_candidate;
  return v_candidate;
end;
$$;
comment on function private.persist_planner_result(uuid,uuid,uuid,jsonb,text,text,jsonb,uuid) is 'Atomically persists a trusted solver snapshot and next candidate, rate limiting starts and alternatives; retries reuse the result and only a new session spends one credit.';
create function public.persist_planner_result(p_shopper uuid,p_session uuid,p_store uuid,p_snapshot jsonb,
  p_hash text,p_solver text,p_candidate jsonb,p_qr uuid default null)
returns uuid language sql set search_path = '' as $$
  select private.persist_planner_result(p_shopper,p_session,p_store,p_snapshot,p_hash,p_solver,p_candidate,p_qr);
$$;
comment on function public.persist_planner_result(uuid,uuid,uuid,jsonb,text,text,jsonb,uuid) is 'Service-only atomic boundary for server-verified shopper plans; browser callers cannot author candidates.';
