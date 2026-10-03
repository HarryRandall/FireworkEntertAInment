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
