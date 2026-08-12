-- Keep Modal analysis work durable across short-lived Vercel invocations.

alter table public.song_analyses
  add column if not exists analyser_job_id text,
  add column if not exists analyser_job_submitted_at timestamptz;

alter table public.song_analyses
  drop constraint if exists song_analyses_analyser_job_pair_check,
  add constraint song_analyses_analyser_job_pair_check
    check ((analyser_job_id is null) = (analyser_job_submitted_at is null));

create index if not exists song_analyses_async_poll_idx
  on public.song_analyses (next_retry_at, created_at)
  where status = 'running' and analyser_job_id is not null;

drop function if exists public.claim_song_analysis_attempt(uuid, integer, integer);

create function public.claim_song_analysis_attempt(
  p_analysis_id uuid default null,
  p_lease_seconds integer default 60,
  p_max_attempts integer default 3
)
returns table (
  analysis_id uuid,
  user_id uuid,
  audio_path text,
  personality text,
  attempt_count integer,
  lease_token uuid,
  analyser_job_id text,
  analyser_job_submitted_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_role text := auth.role();
  analysis_row public.song_analyses;
  claimed_token uuid := gen_random_uuid();
  claimed_attempt_count integer;
begin
  if p_lease_seconds not between 30 and 300
    or p_max_attempts not between 1 and 3 then
    raise exception 'Invalid song analysis lease settings.' using errcode = '22023';
  end if;
  if caller_role <> 'service_role' and (
    caller_id is null
    or p_analysis_id is null
    or not coalesce(public.current_user_is_active(), false)
  ) then
    raise exception 'You do not have permission to claim song analysis work.'
      using errcode = '42501';
  end if;

  select analysis.* into analysis_row
  from public.song_analyses analysis
  where analysis.status = 'running'
    and (
      analysis.analyser_job_id is not null
      or analysis.attempt_count < p_max_attempts
    )
    and (p_analysis_id is null or analysis.id = p_analysis_id)
    and (caller_role = 'service_role' or analysis.user_id = caller_id)
    and (analysis.next_retry_at is null or analysis.next_retry_at <= now())
    and (analysis.lease_expires_at is null or analysis.lease_expires_at <= now())
    and exists (
      select 1
      from public.ai_credit_transactions reservation
      where reservation.user_id = analysis.user_id
        and reservation.transaction_type = 'reserve'
        and reservation.status = 'reserved'
        and reservation.reference_type = 'song_analyses'
        and reservation.reference_id = analysis.id
        and reservation.idempotency_key =
          'music-analysis:' || analysis.id::text || ':reserve'
    )
  order by coalesce(analysis.next_retry_at, analysis.created_at), analysis.created_at
  limit 1
  for update skip locked;

  if not found then
    return;
  end if;

  -- Polling an existing Modal call is part of the same attempt. Only a new
  -- submission consumes another retry attempt.
  claimed_attempt_count := analysis_row.attempt_count
    + case when analysis_row.analyser_job_id is null then 1 else 0 end;

  update public.song_analyses
  set attempt_count = claimed_attempt_count,
      lease_token = claimed_token,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      last_attempt_at = now(),
      next_retry_at = null,
      error_message = null
  where id = analysis_row.id;

  return query
  select
    analysis_row.id,
    analysis_row.user_id,
    analysis_row.audio_path,
    analysis_row.personality,
    claimed_attempt_count,
    claimed_token,
    analysis_row.analyser_job_id,
    analysis_row.analyser_job_submitted_at;
end;
$$;

revoke execute on function public.claim_song_analysis_attempt(uuid, integer, integer)
  from public, anon;
grant execute on function public.claim_song_analysis_attempt(uuid, integer, integer)
  to authenticated, service_role;

create or replace function public.record_song_analysis_job_submission(
  p_analysis_id uuid,
  p_lease_token uuid,
  p_analyser_job_id text,
  p_poll_delay_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_role text := auth.role();
  affected_rows integer;
begin
  if nullif(btrim(p_analyser_job_id), '') is null
    or length(p_analyser_job_id) > 200
    or p_poll_delay_seconds not between 5 and 300 then
    raise exception 'Invalid analyser job submission.' using errcode = '22023';
  end if;
  if caller_role <> 'service_role' and (
    caller_id is null
    or not coalesce(public.current_user_is_active(), false)
  ) then
    raise exception 'You do not have permission to submit song analysis work.'
      using errcode = '42501';
  end if;

  update public.song_analyses analysis
  set analyser_job_id = btrim(p_analyser_job_id),
      analyser_job_submitted_at = now(),
      lease_token = null,
      lease_expires_at = null,
      next_retry_at = now() + make_interval(secs => p_poll_delay_seconds),
      error_message = null
  where analysis.id = p_analysis_id
    and analysis.status = 'running'
    and analysis.analyser_job_id is null
    and analysis.lease_token = p_lease_token
    and analysis.lease_expires_at > now()
    and (caller_role = 'service_role' or caller_id = analysis.user_id);
  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;

revoke execute on function public.record_song_analysis_job_submission(
  uuid, uuid, text, integer
) from public, anon;
grant execute on function public.record_song_analysis_job_submission(
  uuid, uuid, text, integer
) to authenticated, service_role;

create or replace function public.defer_song_analysis_job_poll(
  p_analysis_id uuid,
  p_lease_token uuid,
  p_analyser_job_id text,
  p_poll_delay_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_role text := auth.role();
  affected_rows integer;
begin
  if nullif(btrim(p_analyser_job_id), '') is null
    or p_poll_delay_seconds not between 5 and 300 then
    raise exception 'Invalid analyser poll deferral.' using errcode = '22023';
  end if;
  if caller_role <> 'service_role' and (
    caller_id is null
    or not coalesce(public.current_user_is_active(), false)
  ) then
    raise exception 'You do not have permission to poll song analysis work.'
      using errcode = '42501';
  end if;

  update public.song_analyses analysis
  set lease_token = null,
      lease_expires_at = null,
      next_retry_at = now() + make_interval(secs => p_poll_delay_seconds)
  where analysis.id = p_analysis_id
    and analysis.status = 'running'
    and analysis.analyser_job_id = btrim(p_analyser_job_id)
    and analysis.lease_token = p_lease_token
    and analysis.lease_expires_at > now()
    and (caller_role = 'service_role' or caller_id = analysis.user_id);
  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;

revoke execute on function public.defer_song_analysis_job_poll(
  uuid, uuid, text, integer
) from public, anon;
grant execute on function public.defer_song_analysis_job_poll(
  uuid, uuid, text, integer
) to authenticated, service_role;

create or replace function public.schedule_song_analysis_retry(
  p_analysis_id uuid,
  p_lease_token uuid,
  p_error_message text,
  p_runtime_ms integer,
  p_retry_delay_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_role text := auth.role();
  affected_rows integer;
begin
  if p_retry_delay_seconds not between 5 and 900 or p_runtime_ms < 0 then
    raise exception 'Invalid song analysis retry settings.' using errcode = '22023';
  end if;
  if caller_role <> 'service_role' and (
    caller_id is null
    or not coalesce(public.current_user_is_active(), false)
  ) then
    raise exception 'You do not have permission to retry song analysis work.'
      using errcode = '42501';
  end if;

  update public.song_analyses analysis
  set lease_token = null,
      lease_expires_at = null,
      analyser_job_id = null,
      analyser_job_submitted_at = null,
      next_retry_at = now() + make_interval(secs => p_retry_delay_seconds),
      runtime_ms = p_runtime_ms,
      error_message = left(coalesce(p_error_message, 'Retry scheduled'), 2000)
  where analysis.id = p_analysis_id
    and analysis.status = 'running'
    and analysis.lease_token = p_lease_token
    and analysis.lease_expires_at > now()
    and (caller_role = 'service_role' or caller_id = analysis.user_id);
  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;

revoke execute on function public.schedule_song_analysis_retry(
  uuid, uuid, text, integer, integer
) from public, anon;
grant execute on function public.schedule_song_analysis_retry(
  uuid, uuid, text, integer, integer
) to authenticated, service_role;

create or replace function public.complete_song_analysis_attempt(
  p_analysis_id uuid,
  p_lease_token uuid,
  p_analysis_json jsonb,
  p_markdown text,
  p_schema_version text,
  p_runner_version text,
  p_runtime_ms integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_role text := auth.role();
  analysis_row public.song_analyses;
begin
  if p_analysis_json is null
    or nullif(btrim(p_markdown), '') is null
    or nullif(btrim(p_schema_version), '') is null
    or nullif(btrim(p_runner_version), '') is null
    or p_runtime_ms < 0 then
    raise exception 'Invalid song analysis completion payload.' using errcode = '22023';
  end if;
  if caller_role <> 'service_role' and (
    caller_id is null
    or not coalesce(public.current_user_is_active(), false)
  ) then
    raise exception 'You do not have permission to complete song analysis work.'
      using errcode = '42501';
  end if;

  select analysis.* into analysis_row
  from public.song_analyses analysis
  where analysis.id = p_analysis_id
    and analysis.status = 'running'
    and analysis.lease_token = p_lease_token
    and analysis.lease_expires_at > now()
    and (caller_role = 'service_role' or caller_id = analysis.user_id)
  for update;
  if not found then
    return false;
  end if;

  update public.song_analyses
  set status = 'completed',
      schema_version = btrim(p_schema_version),
      runner_version = btrim(p_runner_version),
      completed_at = now(),
      runtime_ms = p_runtime_ms,
      analysis_json = p_analysis_json,
      markdown = p_markdown,
      error_message = null,
      lease_token = null,
      lease_expires_at = null,
      next_retry_at = null,
      analyser_job_id = null,
      analyser_job_submitted_at = null
  where id = analysis_row.id;

  perform private.resolve_song_analysis_credit(
    analysis_row.id,
    'settled',
    'Song analysis completed'
  );
  return true;
end;
$$;

revoke execute on function public.complete_song_analysis_attempt(
  uuid, uuid, jsonb, text, text, text, integer
) from public, anon;
grant execute on function public.complete_song_analysis_attempt(
  uuid, uuid, jsonb, text, text, text, integer
) to authenticated, service_role;

create or replace function public.fail_song_analysis_attempt(
  p_analysis_id uuid,
  p_lease_token uuid,
  p_error_message text,
  p_runtime_ms integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_role text := auth.role();
  analysis_row public.song_analyses;
  failure_message text := left(
    coalesce(nullif(btrim(p_error_message), ''), 'Song analysis failed'),
    2000
  );
begin
  if p_runtime_ms < 0 then
    raise exception 'Invalid song analysis runtime.' using errcode = '22023';
  end if;
  if caller_role <> 'service_role' and (
    caller_id is null
    or not coalesce(public.current_user_is_active(), false)
  ) then
    raise exception 'You do not have permission to fail song analysis work.'
      using errcode = '42501';
  end if;

  select analysis.* into analysis_row
  from public.song_analyses analysis
  where analysis.id = p_analysis_id
    and analysis.status = 'running'
    and analysis.lease_token = p_lease_token
    and analysis.lease_expires_at > now()
    and (caller_role = 'service_role' or caller_id = analysis.user_id)
  for update;
  if not found then
    return false;
  end if;

  update public.song_analyses
  set status = 'failed',
      completed_at = now(),
      runtime_ms = p_runtime_ms,
      error_message = failure_message,
      lease_token = null,
      lease_expires_at = null,
      next_retry_at = null,
      analyser_job_id = null,
      analyser_job_submitted_at = null
  where id = analysis_row.id;

  perform private.resolve_song_analysis_credit(
    analysis_row.id,
    'refunded',
    failure_message
  );
  return true;
end;
$$;

revoke execute on function public.fail_song_analysis_attempt(uuid, uuid, text, integer)
  from public, anon;
grant execute on function public.fail_song_analysis_attempt(uuid, uuid, text, integer)
  to authenticated, service_role;

create or replace function public.expire_exhausted_song_analyses(
  p_limit integer default 10,
  p_max_attempts integer default 3
)
returns table (
  analysis_id uuid,
  user_id uuid,
  error_message text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  analysis_row public.song_analyses;
  failure_message text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only the reconciliation worker may expire song analyses.'
      using errcode = '42501';
  end if;
  if p_limit not between 1 and 50 or p_max_attempts not between 1 and 3 then
    raise exception 'Invalid song analysis expiry settings.' using errcode = '22023';
  end if;

  for analysis_row in
    select analysis.*
    from public.song_analyses analysis
    where analysis.status = 'running'
      and analysis.analyser_job_id is null
      and analysis.attempt_count >= p_max_attempts
      and (analysis.next_retry_at is null or analysis.next_retry_at <= now())
      and (analysis.lease_expires_at is null or analysis.lease_expires_at <= now())
      and exists (
        select 1
        from public.ai_credit_transactions reservation
        where reservation.user_id = analysis.user_id
          and reservation.transaction_type = 'reserve'
          and reservation.status = 'reserved'
          and reservation.reference_type = 'song_analyses'
          and reservation.reference_id = analysis.id
          and reservation.idempotency_key =
            'music-analysis:' || analysis.id::text || ':reserve'
      )
    order by coalesce(analysis.lease_expires_at, analysis.next_retry_at, analysis.created_at)
    limit p_limit
    for update skip locked
  loop
    failure_message := left(
      coalesce(
        nullif(btrim(analysis_row.error_message), ''),
        'Song analysis stopped before completing its final attempt.'
      ),
      2000
    );

    update public.song_analyses
    set status = 'failed',
        completed_at = now(),
        error_message = failure_message,
        lease_token = null,
        lease_expires_at = null,
        next_retry_at = null
    where id = analysis_row.id;

    perform private.resolve_song_analysis_credit(
      analysis_row.id,
      'refunded',
      failure_message
    );

    analysis_id := analysis_row.id;
    user_id := analysis_row.user_id;
    error_message := failure_message;
    return next;
  end loop;
end;
$$;

revoke execute on function public.expire_exhausted_song_analyses(integer, integer)
  from public, anon, authenticated;
grant execute on function public.expire_exhausted_song_analyses(integer, integer)
  to service_role;

comment on column public.song_analyses.analyser_job_id is
  'Opaque Modal function-call ID used to poll durable analysis work.';
comment on column public.song_analyses.analyser_job_submitted_at is
  'Submission time used to bound polling of a Modal analysis call.';
