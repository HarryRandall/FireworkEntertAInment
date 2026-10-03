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
-- Shopper soundtrack snapshots carry the exact shared analysis used for their cues.
alter table public.music_tracks add column source_audio_url text
  check (source_audio_url ~ '^https://(prod-1\.storage\.jamendo\.com|prod-2\.storage\.jamendo\.com|storage\.jamendo\.com)/');
comment on column public.music_tracks.source_audio_url is 'Validated provider audio source for pending analysis and playback; never supplied directly by a shopper.';
alter table public.plan_candidates add column soundtrack_track_id uuid references public.music_tracks(id);
alter table public.plan_candidates add column soundtrack_analysis_id uuid references public.music_analyses(id);


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
  insert into public.plan_candidates(session_id,rank,mood,name,cues,total_minor,currency,duration_ms,scores,picked_at,soundtrack_track_id,soundtrack_analysis_id)
    values (p_session,v_rank,p_candidate->>'mood',p_candidate->>'name',p_candidate->'cues',(p_candidate->>'total_minor')::bigint,
      p_candidate->>'currency',(p_candidate->>'duration_ms')::int,p_candidate->'scores',clock_timestamp(),(p_snapshot->'answers'->>'soundtrack')::uuid,
      (select soundtrack_analysis_id from public.plan_candidates where session_id = p_session order by rank desc limit 1)) returning id into v_candidate;
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

-- Trusted edits serialise with alternatives and settle history and the revised plan together.
create function private.persist_plan_edit(p_shopper uuid,p_session uuid,p_candidate uuid,
  p_revision int,p_seq int,p_hash text,p_edit jsonb,p_snapshot jsonb,p_result jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  -- Product abuse budget: six edits in a burst, earning one token per minute.
  v_capacity constant int := 6;
  v_refill_seconds constant int := 60;
  v_session public.plan_sessions;
  v_candidate public.plan_candidates;
  v_id uuid := (p_edit->>'id')::uuid;
  v_previous public.plan_edits;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_session::text,0));
  select session.* into v_session from public.plan_sessions as session where session.id = p_session for update;
  if v_session.shopper_id is distinct from p_shopper or not exists (
    select from public.profiles as profile where profile.id = p_shopper and profile.status = 'active') then
    raise exception using errcode = '42501',message = 'Owned active planning session required';
  end if;
  select edit.* into v_previous from public.plan_edits as edit where edit.id = v_id;
  if v_previous.id is not null then
    if v_previous.session_id <> p_session or v_previous.candidate_id <> p_candidate then
      raise exception using errcode = '42501',message = 'Edit identity mismatch';
    end if;
    return v_id;
  end if;
  select candidate.* into v_candidate from public.plan_candidates as candidate
    where candidate.id = p_candidate and candidate.session_id = p_session for update;
  if v_candidate.id is null or v_candidate.revision <> p_revision or v_session.input_hash <> p_hash
    or v_candidate.rank <> (select max(candidate.rank) from public.plan_candidates as candidate where candidate.session_id = p_session)
    or p_seq <> (select coalesce(max(edit.seq),0) + 1 from public.plan_edits as edit where edit.session_id = p_session) then
    raise exception using errcode = '40001',message = 'Plan changed; reload before editing';
  end if;
  if p_edit->>'source' not in ('chip','rule') or p_edit->>'outcome' not in ('applied','clarify','infeasible')
    or (p_edit->>'outcome' = 'applied') <> (p_result is not null)
    or p_edit->>'source' is null or p_edit->>'outcome' is null then
    raise exception using errcode = '23514',message = 'Structured non-AI edit required';
  end if;
  if not private.consume_rate_limit('planner:edit:' || p_shopper,v_capacity,1.0 / v_refill_seconds) then
    raise exception using errcode = 'P0001',message = 'Planner rate limit reached';
  end if;
  if p_result is not null then
    if p_snapshot->>'store_id' is distinct from v_session.store_id::text
      or p_snapshot->'age_confirmation' is distinct from v_session.solver_snapshot->'age_confirmation'
      or p_result->>'currency' is distinct from v_candidate.currency::text
      or (p_result->>'total_minor')::bigint > (p_snapshot->'answers'->>'budget_minor')::bigint then
      raise exception using errcode = '23514',message = 'Edit snapshot mismatch';
    end if;
    update public.plan_candidates set revision = revision + 1,name = p_result->>'name',
      mood = p_result->>'mood',cues = p_result->'cues',total_minor = (p_result->>'total_minor')::bigint,
      duration_ms = (p_result->>'duration_ms')::int,scores = p_result->'scores'
      where id = p_candidate;
    update public.plan_sessions set answers = p_snapshot->'answers',solver_snapshot = p_snapshot,
      input_hash = p_edit->>'input_hash' where id = p_session;
  end if;
  insert into public.plan_edits(id,session_id,candidate_id,seq,message,source,ops,diff,outcome,reply)
    values (v_id,p_session,p_candidate,p_seq,p_edit->>'message',p_edit->>'source',p_edit->'ops',
      nullif(p_edit->'diff','null'::jsonb),p_edit->>'outcome',p_edit->>'reply');
  return v_id;
end;
$$;
comment on function private.persist_plan_edit(uuid,uuid,uuid,int,int,text,jsonb,jsonb,jsonb) is 'Service-only atomic edit history and candidate revision with ownership, stale-write, retry and rate-limit fences; never charges credits.';
create function public.persist_plan_edit(p_shopper uuid,p_session uuid,p_candidate uuid,
  p_revision int,p_seq int,p_hash text,p_edit jsonb,p_snapshot jsonb,p_result jsonb)
returns uuid language sql set search_path = '' as $$
  select private.persist_plan_edit(p_shopper,p_session,p_candidate,p_revision,p_seq,p_hash,p_edit,p_snapshot,p_result);
$$;
comment on function public.persist_plan_edit(uuid,uuid,uuid,int,int,text,jsonb,jsonb,jsonb) is 'Persists a server-verified chip or rule edit; shoppers cannot author results directly.';

create function private.validate_plan_soundtrack()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.soundtrack_analysis_id is not null and not exists (
    select from public.music_analyses analysis where analysis.id = new.soundtrack_analysis_id
      and analysis.track_id = new.soundtrack_track_id) then
    raise exception using errcode = '23514',message = 'Analysis must match plan soundtrack';
  end if;
  return new;
end;
$$;
comment on function private.validate_plan_soundtrack() is 'Ensures each candidate pins features belonging to its selected soundtrack.';
create trigger validate_plan_soundtrack before insert or update on public.plan_candidates
  for each row execute function private.validate_plan_soundtrack();

create function private.import_shopper_track(p_shopper uuid,p_session uuid,p_track jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  v_track uuid;
  -- Import abuse budget: six requests in a burst, one restored token per minute.
  v_capacity constant int := 6;
  v_refill_seconds constant int := 60;
begin
  if not exists (select from public.plan_sessions session join public.profiles profile on profile.id = session.shopper_id
    where session.id = p_session and session.shopper_id = p_shopper and profile.status = 'active') then
    raise exception using errcode = '42501',message = 'Owned active planning session required';
  end if;
  if not private.consume_rate_limit('music:import:' || p_shopper,v_capacity,1.0 / v_refill_seconds) then
    raise exception using errcode = 'P0001',message = 'Planner rate limit reached';
  end if;
  insert into public.music_tracks(provider,provider_track_id,title,artist,duration_ms,licence_code,licence_url,attribution,source_audio_url,status)
    values ('jamendo',p_track->>'provider_track_id',p_track->>'title',p_track->>'artist',(p_track->>'duration_ms')::int,
      p_track->>'licence_code',p_track->>'licence_url',p_track->>'attribution',p_track->>'audio_url','published')
    on conflict (provider,provider_track_id) do update set title = excluded.title,artist = excluded.artist,
      licence_code = excluded.licence_code,licence_url = excluded.licence_url,attribution = excluded.attribution,
      source_audio_url = excluded.source_audio_url
    where public.music_tracks.status <> 'withdrawn' returning id into v_track;
  if v_track is null then raise exception using errcode = '23514',message = 'Track is unavailable'; end if;
  if not exists (select from public.music_analyses analysis where analysis.track_id = v_track and analysis.is_current) then
    insert into public.jobs(kind,payload) values ('music_analyse',jsonb_build_object('track_id',v_track,'audio_url',p_track->>'audio_url'))
      on conflict do nothing;
  end if;
  return v_track;
end;
$$;
comment on function private.import_shopper_track(uuid,uuid,jsonb) is 'Imports server-validated Jamendo metadata for an owned session; reuses shared identity and queues at most one active analysis without spending credits.';
create function public.import_shopper_track(p_shopper uuid,p_session uuid,p_track jsonb)
returns uuid language sql set search_path = '' as $$ select private.import_shopper_track(p_shopper,p_session,p_track); $$;
comment on function public.import_shopper_track(uuid,uuid,jsonb) is 'Service-only transactional import and deduplicated shared analysis enqueue.';

create function private.plan_soundtrack(p_session uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
#variable_conflict error
declare
  v_candidate public.plan_candidates;
begin
  if not private.owns_plan(p_session) then return null; end if;
  select candidate.* into v_candidate from public.plan_candidates candidate where candidate.session_id = p_session order by rank desc limit 1;
  return (select jsonb_build_object('track_id',track.id,'provider_track_id',track.provider_track_id,'title',track.title,'artist',track.artist,
    'licence_code',track.licence_code,'licence_url',track.licence_url,'attribution',track.attribution,
    'source_audio_url',track.source_audio_url,'audio_media_id',case when analysis.id is null then track.audio_media_id else
      (select media.id from public.media media where media.bucket = 'audio' and media.path = track.id::text || '/' || analysis.audio_sha256) end,
    'analysis_id',analysis.id,'analysis',analysis.analysis,'pinned_analysis_id',v_candidate.soundtrack_analysis_id)
    from public.music_tracks track left join public.music_analyses analysis on analysis.track_id = track.id
      and (case when v_candidate.soundtrack_analysis_id is null then analysis.is_current else analysis.id = v_candidate.soundtrack_analysis_id end)
    where track.id = v_candidate.soundtrack_track_id and track.status = 'published');
end;
$$;
comment on function private.plan_soundtrack(uuid) is 'Owned soundtrack metadata and exact pinned features, or current features when a pending candidate can be retimed; analysis clocks are seconds.';
create function public.plan_soundtrack(p_session uuid)
returns jsonb language sql stable set search_path = '' as $$ select private.plan_soundtrack(p_session); $$;
comment on function public.plan_soundtrack(uuid) is 'Returns only the caller-owned latest candidate soundtrack; unauthorised and silent plans return null.';

create function private.persist_plan_music(p_shopper uuid,p_session uuid,p_candidate uuid,p_revision int,p_hash text,
  p_snapshot jsonb,p_result jsonb,p_track uuid default null,p_analysis uuid default null,p_next_hash text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  v_session public.plan_sessions;
  v_candidate public.plan_candidates;
  -- Same bounded mutation budget as chip edits: six requests, one token per minute.
  v_capacity constant int := 6;
  v_refill_seconds constant int := 60;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_session::text,0));
  select session.* into v_session from public.plan_sessions session where session.id = p_session for update;
  if v_session.shopper_id is distinct from p_shopper or not exists (
    select from public.profiles profile where profile.id = p_shopper and profile.status = 'active') then
    raise exception using errcode = '42501',message = 'Owned active planning session required';
  end if;
  select candidate.* into v_candidate from public.plan_candidates candidate where candidate.id = p_candidate and candidate.session_id = p_session for update;
  if v_candidate.id is null or v_candidate.revision <> p_revision or v_session.input_hash <> p_hash
    or v_candidate.rank <> (select max(rank) from public.plan_candidates where session_id = p_session) then
    raise exception using errcode = '40001',message = 'Plan changed; reload before editing';
  end if;
  if nullif(p_next_hash,'') is null or p_snapshot->>'store_id' is distinct from v_session.store_id::text
    or p_snapshot->'age_confirmation' is distinct from v_session.solver_snapshot->'age_confirmation'
    or p_snapshot->'answers'->>'soundtrack' is distinct from p_track::text
    or p_result->>'currency' is distinct from v_candidate.currency::text
    or (p_result->>'total_minor')::bigint > (p_snapshot->'answers'->>'budget_minor')::bigint
    or (p_analysis is not null and not exists (select from public.music_analyses analysis
      where analysis.id = p_analysis and analysis.track_id = p_track and analysis.analysis = p_snapshot->'music'))
    or (p_analysis is null and p_snapshot->'music' is distinct from 'null'::jsonb) then
    raise exception using errcode = '23514',message = 'Music snapshot mismatch';
  end if;
  if p_track is not null and not exists (select from public.music_tracks track where track.id = p_track and track.status = 'published') then
    raise exception using errcode = '23514',message = 'Track is unavailable';
  end if;
  if not private.consume_rate_limit('planner:edit:' || p_shopper,v_capacity,1.0 / v_refill_seconds) then
    raise exception using errcode = 'P0001',message = 'Planner rate limit reached';
  end if;
  update public.plan_candidates set revision = revision + 1,name = p_result->>'name',mood = p_result->>'mood',
    cues = p_result->'cues',total_minor = (p_result->>'total_minor')::bigint,duration_ms = (p_result->>'duration_ms')::int,
    scores = p_result->'scores',soundtrack_track_id = p_track,soundtrack_analysis_id = p_analysis where id = p_candidate;
  update public.plan_sessions set answers = p_snapshot->'answers',solver_snapshot = p_snapshot,input_hash = p_next_hash where id = p_session;
  return p_candidate;
end;
$$;
comment on function private.persist_plan_music(uuid,uuid,uuid,int,text,jsonb,jsonb,uuid,uuid,text) is 'Atomically revises an owned server-solved candidate and pins its analysis with stale-write and abuse fences; never charges a credit.';
create function public.persist_plan_music(p_shopper uuid,p_session uuid,p_candidate uuid,p_revision int,p_hash text,
  p_snapshot jsonb,p_result jsonb,p_track uuid default null,p_analysis uuid default null,p_next_hash text default null)
returns uuid language sql set search_path = '' as $$
  select private.persist_plan_music(p_shopper,p_session,p_candidate,p_revision,p_hash,p_snapshot,p_result,p_track,p_analysis,p_next_hash);
$$;
comment on function public.persist_plan_music(uuid,uuid,uuid,int,text,jsonb,jsonb,uuid,uuid,text) is 'Service-only persistence of a verified soundtrack solve and its immutable feature identity.';

-- Saved show playback reads the version's pin, never a replacement current analysis.
create function private.show_soundtrack(p_store uuid,p_show uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('track_id',track.id,'provider_track_id',track.provider_track_id,'title',track.title,
    'artist',track.artist,'licence_code',track.licence_code,'licence_url',track.licence_url,'attribution',track.attribution,
    'source_audio_url',track.source_audio_url,'audio_media_id',case when analysis.id is null then track.audio_media_id else
      (select media.id from public.media media where media.bucket = 'audio' and media.path = track.id::text || '/' || analysis.audio_sha256) end,
    'analysis_id',analysis.id,'analysis',analysis.analysis,'pinned_analysis_id',version.soundtrack_analysis_id,
    'offset_ms',version.soundtrack_offset_ms)
  from public.shows show join public.show_versions version on version.id = show.current_version_id
    join public.music_tracks track on track.id = show.soundtrack_track_id and track.status = 'published'
    left join public.music_analyses analysis on analysis.id = version.soundtrack_analysis_id and analysis.track_id = track.id
  where show.id = p_show and private.show_for_store(p_show,p_store) is not null;
$$;
comment on function private.show_soundtrack(uuid,uuid) is 'Returns attribution and pinned music for a show visible at this store, including the version offset in milliseconds from audio origin.';
create function public.show_soundtrack(p_store uuid,p_show uuid)
returns jsonb language sql stable set search_path = '' as $$ select private.show_soundtrack(p_store,p_show); $$;
comment on function public.show_soundtrack(uuid,uuid) is 'Public soundtrack read through the existing store/show visibility fence; inaccessible shows return null.';

create function private.music_track_analysis(p_session uuid,p_track uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('analysis_id',analysis.id,'analysis',analysis.analysis)
  from public.music_analyses analysis join public.music_tracks track on track.id = analysis.track_id
  where private.owns_plan(p_session) and track.id = p_track and track.status = 'published' and analysis.is_current;
$$;
comment on function private.music_track_analysis(uuid,uuid) is 'Reads validated-provider track features only within an owned planning session; current features use seconds from audio origin.';
create function public.music_track_analysis(p_session uuid,p_track uuid)
returns jsonb language sql stable set search_path = '' as $$ select private.music_track_analysis(p_session,p_track); $$;
comment on function public.music_track_analysis(uuid,uuid) is 'Ownership-fenced lookup for a newly selected published soundtrack; no raw music table read is required.';

-- Owned till lists, sale-window expiry and saved shopper account summaries.
create function private.list_sale_end(p_store uuid)
returns date language plpgsql stable security definer set search_path = '' as $$
#variable_conflict error
declare
  v_store public.stores;
  v_today date;
  v_end date;
begin
  select * into v_store from public.stores where id = p_store;
  v_today := (now() at time zone v_store.timezone)::date;
  if not coalesce(private.planner_sale_open(p_store),false) then
    raise exception using errcode = '23514', message = 'Shop sales are closed';
  end if;
  select max(case when period.rule->>'from' > period.rule->>'to'
      and to_char(v_today,'MM-DD') >= period.rule->>'from'
    then (extract(year from v_today)::int + 1)::text || '-' || (period.rule->>'to')
    else extract(year from v_today)::int::text || '-' || (period.rule->>'to') end)::date into v_end
    from public.sale_periods as period where period.market = v_store.market
      and (period.region is null or period.region = v_store.region) and period.rule->>'type' = 'fixed'
      and case when period.rule->>'from' <= period.rule->>'to'
        then to_char(v_today,'MM-DD') between period.rule->>'from' and period.rule->>'to'
        else to_char(v_today,'MM-DD') >= period.rule->>'from' or to_char(v_today,'MM-DD') <= period.rule->>'to' end;
  -- An all-year licence has an annual list validity boundary in the store's calendar.
  return coalesce(v_end,make_date(extract(year from v_today)::int,12,31));
end;
$$;
comment on function private.list_sale_end(uuid) is 'Returns the inclusive fixed sale-window end in store time, or calendar year end for an all-year licence; unsupported calendars fail closed.';

create table private.shopper_list_requests (
  id uuid primary key,
  shopper_id uuid not null references public.profiles(id) on delete cascade,
  list_id uuid not null references public.lists(id) on delete cascade,
  product_id uuid references public.products(id),
  candidate_id uuid references public.plan_candidates(id),
  revision int
);
alter table private.shopper_list_requests enable row level security;
comment on table private.shopper_list_requests is 'Private replay keys for transactional list additions; API roles have no table access.';

create function private.add_shopper_list(p_store uuid,p_request uuid,p_product uuid,p_candidate uuid,p_revision int)
returns uuid language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  v_list uuid;
  v_items jsonb;
  v_candidate public.plan_candidates;
  v_end date;
  v_show uuid;
  v_existing private.shopper_list_requests;
  v_price bigint;
  v_currency char(3);
  v_quantity int;
  v_stock int;
begin
  if not coalesce(private.owns_shopper(private.uid()),false) then
    raise exception using errcode = '42501', message = 'Active shopper required';
  end if;
  -- Serialise one shopper's additions and replay checks without reserving store stock.
  perform pg_advisory_xact_lock(hashtextextended(private.uid()::text,0));
  if p_request is null then
    raise exception using errcode = '23514', message = 'List request key required';
  end if;
  select * into v_existing from private.shopper_list_requests where id = p_request;
  if v_existing.id is not null then
    if v_existing.shopper_id <> private.uid() or v_existing.product_id is distinct from p_product
      or v_existing.candidate_id is distinct from p_candidate
      or v_existing.revision is distinct from p_revision
      or not exists (select from public.lists where id = v_existing.list_id and store_id = p_store) then
      raise exception using errcode = '42501', message = 'List request ownership mismatch';
    end if;
    return v_existing.list_id;
  end if;
  if (p_product is null) = (p_candidate is null) or private.store_page(p_store) is null then
    raise exception using errcode = '23514', message = 'Choose one visible product or plan';
  end if;
  v_end := private.list_sale_end(p_store);
  if p_candidate is not null then
    select candidate.* into v_candidate from public.plan_candidates as candidate
      join public.plan_sessions as session on session.id = candidate.session_id
      where candidate.id = p_candidate and session.store_id = p_store and private.owns_shopper(session.shopper_id)
      for update of candidate;
    if v_candidate.id is null then
      raise exception using errcode = '42501', message = 'Own candidate at matching store required';
    end if;
    if v_candidate.revision is distinct from p_revision then
      raise exception using errcode = '23514', message = 'Plan changed; reload before saving';
    end if;
    select jsonb_agg(jsonb_build_object('product_id',item.product,'quantity',item.quantity)) into v_items
      from (select cue->>'product_id' as product,count(*) as quantity
        from jsonb_array_elements(v_candidate.cues) as cue group by cue->>'product_id') as item;
  else
    v_items := jsonb_build_array(jsonb_build_object('product_id',p_product,'quantity',1));
  end if;
  if p_product is not null then
    select id into v_list from public.lists where shopper_id = private.uid() and store_id = p_store
      and plan_candidate_id is null and status = 'open' and valid_until = v_end
      order by created_at desc limit 1 for update;
  end if;
  if v_list is null then
    v_list := private.create_list(p_store,v_items,
      lpad((('x' || substr(encode(extensions.gen_random_bytes(8),'hex'),1,13))::bit(52)::bigint)::text,16,'0'),v_end,p_candidate);
  else
    select price_minor,currency,stock_qty into v_price,v_currency,v_stock
      from private.shopper_store_products(p_store) where product_id = p_product;
    select coalesce((select quantity from public.list_items where list_id = v_list and product_id = p_product),0) + 1 into v_quantity;
    if v_price is null or v_stock < v_quantity then
      raise exception using errcode = '23514', message = 'List product unavailable at store';
    end if;
    -- Existing products keep the price of their first addition, even if the shop changes its price.
    insert into public.list_items(list_id,product_id,quantity,unit_price_minor,currency)
      values (v_list,p_product,v_quantity,v_price,v_currency)
      on conflict (list_id,product_id) do update set quantity = excluded.quantity;
  end if;
  insert into private.shopper_list_requests(id,shopper_id,list_id,product_id,candidate_id,revision)
    values (p_request,private.uid(),v_list,p_product,p_candidate,p_revision);
  if p_candidate is not null then
    insert into public.shows(owner_id,name,origin,soundtrack_track_id)
      values (private.uid(),coalesce(v_candidate.name,'My garden show'),'planner',v_candidate.soundtrack_track_id)
      returning id into v_show;
    perform private.save_show(v_show,v_candidate.cues,v_candidate.duration_ms,v_candidate.soundtrack_analysis_id,
      0,v_candidate.session_id,'Saved from a plan');
    update public.shows set status = 'live' where id = v_show;
  end if;
  return v_list;
end;
$$;

comment on function private.add_shopper_list(uuid,uuid,uuid,uuid,int) is 'Atomically saves one product or an owned current plan, snapshots current prices, generates a sixteen-digit barcode and saves the planned show; request UUID makes retries idempotent. Never reserves stock.';
create function public.add_shopper_list(p_store uuid,p_request uuid,p_product uuid default null,p_candidate uuid default null,p_revision int default null)
returns uuid language sql set search_path = '' as $$ select private.add_shopper_list(p_store,p_request,p_product,p_candidate,p_revision); $$;
comment on function public.add_shopper_list(uuid,uuid,uuid,uuid,int) is 'Adds a product or current owned candidate to a new till list; returns the list UUID. Prices are minor-unit snapshots and validity is server-derived.';

create function private.set_list_quantity(p_list uuid,p_product uuid,p_quantity int)
returns void language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  v_list public.lists;
  v_stock int;
begin
  select * into v_list from public.lists where id = p_list for update;
  if v_list.id is null or not coalesce(private.owns_shopper(v_list.shopper_id),false) then
    raise exception using errcode = '42501', message = 'Own list required';
  end if;
  if v_list.status <> 'open' or v_list.valid_until < (now() at time zone (select timezone from public.stores where id = v_list.store_id))::date then
    raise exception using errcode = '23514', message = 'List is no longer editable';
  end if;
  -- The database quantity column is a positive smallint; zero means remove.
  if p_quantity is null or p_quantity < 0 or p_quantity > 32767 then
    raise exception using errcode = '23514', message = 'Invalid quantity';
  end if;
  if not exists (select from public.list_items where list_id = p_list and product_id = p_product) then
    raise exception using errcode = '23514', message = 'List item unavailable';
  end if;
  if p_quantity = 0 then
    delete from public.list_items where list_id = p_list and product_id = p_product;
  else
    select stock_qty into v_stock from private.shopper_store_products(v_list.store_id) where product_id = p_product;
    if v_stock is null or v_stock < p_quantity then
      raise exception using errcode = '23514', message = 'Quantity exceeds current stock';
    end if;
    update public.list_items set quantity = p_quantity where list_id = p_list and product_id = p_product;
  end if;
end;
$$;
comment on function private.set_list_quantity(uuid,uuid,int) is 'Changes an owned open unexpired list quantity without changing its price snapshot; zero removes the item. Stock is checked but never reserved.';
create function public.set_list_quantity(p_list uuid,p_product uuid,p_quantity int)
returns void language sql set search_path = '' as $$ select private.set_list_quantity(p_list,p_product,p_quantity); $$;
comment on function public.set_list_quantity(uuid,uuid,int) is 'Sets an existing owned list item quantity, or removes it with zero, preserving minor-unit prices.';

create function private.shopper_account()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
#variable_conflict error
begin
  if not coalesce(private.owns_shopper(private.uid()),false) then
    raise exception using errcode = '42501', message = 'Active shopper required';
  end if;
  return jsonb_build_object(
    'lists',coalesce((select jsonb_agg(to_jsonb(list) || jsonb_build_object('store_name',store.name,'store_slug',store.slug,
      'status',case when list.status = 'open' and list.valid_until < (now() at time zone store.timezone)::date then 'expired' else list.status end,
      'organisation_id',store.organisation_id,'items',coalesce((select jsonb_agg(to_jsonb(item) || jsonb_build_object('name',product.name))
        from public.list_items as item join public.products as product on product.id = item.product_id where item.list_id = list.id),'[]'::jsonb)) order by list.created_at desc)
      from public.lists as list join public.stores as store on store.id = list.store_id where list.shopper_id = private.uid()),'[]'::jsonb),
    'shows',coalesce((select jsonb_agg(jsonb_build_object('id',show.id,'name',show.name,'version_id',show.current_version_id,'session_id',version.plan_session_id))
      from public.shows as show join public.show_versions as version on version.id = show.current_version_id where show.owner_id = private.uid()),'[]'::jsonb),
    'plans',coalesce((select jsonb_agg(jsonb_build_object('id',session.id,'store_slug',store.slug,'store_name',store.name,'created_at',session.created_at,'status',session.status) order by session.created_at desc)
      from public.plan_sessions as session join public.stores as store on store.id = session.store_id where session.shopper_id = private.uid()),'[]'::jsonb),
    'follows',coalesce((select jsonb_agg(to_jsonb(follow) || jsonb_build_object('name',organisation.name))
      from public.follows as follow join public.organisations as organisation on organisation.id = follow.organisation_id where follow.shopper_id = private.uid()),'[]'::jsonb),
    'requests',coalesce((select jsonb_agg(to_jsonb(request) order by request.created_at desc) from public.privacy_requests as request where request.shopper_id = private.uid()),'[]'::jsonb));
end;
$$;
comment on function private.shopper_account() is 'Reads only the active caller account, enriching owned snapshots with shop and product labels without exposing retailer administration.';
create function public.shopper_account()
returns jsonb language sql stable set search_path = '' as $$ select private.shopper_account(); $$;
comment on function public.shopper_account() is 'Returns owned lists, saved shows, planning history, per-shop consent and privacy request status for the active shopper.';
