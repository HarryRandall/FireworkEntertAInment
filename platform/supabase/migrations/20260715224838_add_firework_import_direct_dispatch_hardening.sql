-- Persist direct Modal dispatch separately from worker execution provenance.
-- The reconstruction schema predates this lifecycle, so it must remain a
-- follow-up to the already-applied import migration.

alter table public.import_runs
  add column direct_dispatch_status text not null default 'pending'
    check (direct_dispatch_status in ('pending', 'dispatching', 'accepted', 'failed', 'worker_claimed')),
  add column direct_dispatch_call_id text,
  add column direct_dispatch_attempt_count integer not null default 0
    check (direct_dispatch_attempt_count between 0 and 3),
  add column direct_dispatch_error text,
  add column direct_dispatch_updated_at timestamptz,
  add constraint import_runs_direct_dispatch_call_id check (
    direct_dispatch_call_id is null
    or char_length(btrim(direct_dispatch_call_id)) between 1 and 240
  ),
  add constraint import_runs_direct_dispatch_error check (
    direct_dispatch_error is null
    or char_length(btrim(direct_dispatch_error)) between 1 and 1000
  ),
  add constraint import_runs_direct_dispatch_state check (
    (direct_dispatch_status = 'pending'
      and direct_dispatch_call_id is null
      and direct_dispatch_attempt_count = 0
      and direct_dispatch_error is null
      and direct_dispatch_updated_at is null)
    or (direct_dispatch_status = 'dispatching'
      and direct_dispatch_call_id is null
      and direct_dispatch_attempt_count = 0
      and direct_dispatch_error is null
      and direct_dispatch_updated_at is not null)
    or (direct_dispatch_status = 'accepted'
      and direct_dispatch_call_id is not null
      and direct_dispatch_attempt_count between 1 and 3
      and direct_dispatch_error is null
      and direct_dispatch_updated_at is not null)
    or (direct_dispatch_status = 'failed'
      and direct_dispatch_call_id is null
      and direct_dispatch_attempt_count between 0 and 3
      and direct_dispatch_error is not null
      and direct_dispatch_updated_at is not null)
    or (direct_dispatch_status = 'worker_claimed'
      and direct_dispatch_call_id is null
      and direct_dispatch_attempt_count between 0 and 3
      and direct_dispatch_updated_at is not null)
  );

-- Worker claims predate direct dispatch. Hook the existing queued-to-processing
-- transition so a direct response racing the claim cannot refund live work.
create or replace function private.mark_firework_import_worker_claimed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'queued'
    and new.status = 'processing'
    and new.direct_dispatch_status in ('pending', 'dispatching') then
    new.direct_dispatch_status := 'worker_claimed';
    new.direct_dispatch_call_id := null;
    new.direct_dispatch_error := null;
    new.direct_dispatch_updated_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function private.mark_firework_import_worker_claimed()
  from public, anon, authenticated, service_role;

create trigger import_runs_mark_worker_claimed_before_processing
  before update of status on public.import_runs
  for each row execute function private.mark_firework_import_worker_claimed();

-- The platform verifies its configured service-role client before reserving
-- credits. This RPC intentionally exposes no data; its grant and explicit
-- claim check prove that dispatch lifecycle writes can be completed.
create or replace function public.check_firework_import_dispatch_ready()
returns boolean
language plpgsql
stable
set search_path = ''
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Only the trusted platform can verify import dispatch.'
      using errcode = '42501';
  end if;
  return true;
end;
$$;

revoke execute on function public.check_firework_import_dispatch_ready()
  from public, anon, authenticated;
grant execute on function public.check_firework_import_dispatch_ready()
  to service_role;

-- Claim the one direct-dispatch attempt before making the external request.
-- The job is locked before the run to match the worker claim lock order.
create or replace function public.begin_firework_import_dispatch(p_run_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_row public.import_jobs;
  run_row public.import_runs;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Only the trusted platform can begin import dispatch.'
      using errcode = '42501';
  end if;
  if p_run_id is null then
    raise exception 'A reconstruction run is required.' using errcode = '22023';
  end if;

  select job.* into job_row
  from public.import_jobs job
  join public.import_runs run on run.import_job_id = job.id
  where run.id = p_run_id
  for update of job;
  if not found then
    raise exception 'Reconstruction run not found.' using errcode = 'P0002';
  end if;

  select run.* into run_row
  from public.import_runs run
  where run.id = p_run_id
    and run.import_job_id = job_row.id
  for update;
  if not found then
    raise exception 'Reconstruction run not found.' using errcode = 'P0002';
  end if;

  if run_row.status <> 'queued'
    or job_row.active_run_id is distinct from run_row.id
    or job_row.status <> 'queued'
    or job_row.archived_at is not null
    or run_row.direct_dispatch_status <> 'pending' then
    return false;
  end if;

  update public.import_runs
  set direct_dispatch_status = 'dispatching',
      direct_dispatch_updated_at = now()
  where id = run_row.id;
  return true;
end;
$$;

revoke execute on function public.begin_firework_import_dispatch(uuid)
  from public, anon, authenticated;
grant execute on function public.begin_firework_import_dispatch(uuid)
  to service_role;

-- Persist a strict Modal acknowledgement, or close and refund the run after
-- the platform has no safe retry left. A run already claimed by any worker is
-- marked as such and is never failed or refunded by the dispatch path.
create or replace function public.record_firework_import_dispatch_result(
  p_run_id uuid,
  p_outcome text,
  p_attempt_count integer,
  p_call_id text default null,
  p_error text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_row public.import_jobs;
  run_row public.import_runs;
  normalised_call_id text := nullif(btrim(coalesce(p_call_id, '')), '');
  normalised_error text := nullif(btrim(coalesce(p_error, '')), '');
  failure_message text;
  changed_rows integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Only the trusted platform can record import dispatch.'
      using errcode = '42501';
  end if;
  if p_run_id is null
    or p_outcome is null
    or p_attempt_count is null
    or p_outcome not in ('accepted', 'exhausted')
    or p_attempt_count not between 0 and 3
    or (p_outcome = 'accepted' and (
      p_attempt_count < 1
      or normalised_call_id is null
      or char_length(normalised_call_id) > 240
      or normalised_call_id ~ '[[:cntrl:]]'
      or p_error is not null
    ))
    or (p_outcome = 'exhausted' and (
      p_call_id is not null
      or normalised_error is null
      or char_length(normalised_error) > 1000
    )) then
    raise exception 'Invalid import dispatch result.' using errcode = '22023';
  end if;

  select job.* into job_row
  from public.import_jobs job
  join public.import_runs run on run.import_job_id = job.id
  where run.id = p_run_id
  for update of job;
  if not found then
    raise exception 'Reconstruction run not found.' using errcode = 'P0002';
  end if;

  select run.* into run_row
  from public.import_runs run
  where run.id = p_run_id
    and run.import_job_id = job_row.id
  for update;
  if not found then
    raise exception 'Reconstruction run not found.' using errcode = 'P0002';
  end if;

  if p_outcome = 'accepted' then
    if run_row.direct_dispatch_status = 'accepted' then
      if run_row.direct_dispatch_call_id is distinct from normalised_call_id
        or run_row.direct_dispatch_attempt_count is distinct from p_attempt_count then
        raise exception 'Import dispatch was already accepted with different provenance.'
          using errcode = '55000';
      end if;
      return 'accepted';
    end if;
    if run_row.direct_dispatch_status = 'failed' then
      raise exception 'A failed import dispatch cannot later be accepted.' using errcode = '55000';
    end if;
    if run_row.direct_dispatch_status = 'worker_claimed'
      and run_row.direct_dispatch_error is not null then
      raise exception 'An exhausted import dispatch cannot later be accepted.'
        using errcode = '55000';
    end if;

    update public.import_runs
    set direct_dispatch_status = 'accepted',
        direct_dispatch_call_id = normalised_call_id,
        direct_dispatch_attempt_count = p_attempt_count,
        direct_dispatch_error = null,
        direct_dispatch_updated_at = now()
    where id = run_row.id;
    return 'accepted';
  end if;

  if run_row.direct_dispatch_status = 'accepted' then
    return 'accepted';
  end if;
  if run_row.direct_dispatch_status = 'failed' then
    if run_row.direct_dispatch_attempt_count is distinct from p_attempt_count
      or run_row.direct_dispatch_error is distinct from normalised_error then
      raise exception 'Import dispatch failure was already recorded differently.'
        using errcode = '55000';
    end if;
    return 'failed';
  end if;
  if run_row.direct_dispatch_status = 'worker_claimed'
    and run_row.direct_dispatch_error is not null then
    if run_row.direct_dispatch_attempt_count is distinct from p_attempt_count
      or run_row.direct_dispatch_error is distinct from normalised_error then
      raise exception 'Import dispatch exhaustion was already recorded differently.'
        using errcode = '55000';
    end if;
    return 'worker_claimed';
  end if;

  if run_row.status = 'queued'
    and job_row.active_run_id = run_row.id
    and job_row.status = 'queued'
    and job_row.archived_at is null then
    failure_message := left(
      'The reconstruction could not be dispatched. ' || normalised_error,
      2000
    );

    update public.import_runs
    set direct_dispatch_status = 'failed',
        direct_dispatch_call_id = null,
        direct_dispatch_attempt_count = p_attempt_count,
        direct_dispatch_error = normalised_error,
        direct_dispatch_updated_at = now(),
        status = 'failed',
        stage = 'dispatch_failed',
        progress = 0,
        lease_token = null,
        lease_expires_at = null,
        heartbeat_at = null,
        error_message = failure_message,
        completed_at = now()
    where id = run_row.id;

    perform private.resolve_firework_import_credit(
      run_row.id,
      'refunded',
      'Direct reconstruction dispatch failed before a worker claim'
    );

    update public.import_jobs
    set status = 'failed',
        processing_progress = 0,
        error_message = failure_message,
        completed_at = now()
    where id = job_row.id
      and active_run_id = run_row.id
      and status = 'queued';
    get diagnostics changed_rows = row_count;
    if changed_rows <> 1 then
      raise exception 'The reconstruction job advanced during dispatch failure handling.'
        using errcode = '55000';
    end if;
    return 'failed';
  end if;

  update public.import_runs
  set direct_dispatch_status = 'worker_claimed',
      direct_dispatch_call_id = null,
      direct_dispatch_attempt_count = p_attempt_count,
      direct_dispatch_error = normalised_error,
      direct_dispatch_updated_at = now()
  where id = run_row.id;
  return 'worker_claimed';
end;
$$;

revoke execute on function public.record_firework_import_dispatch_result(uuid, text, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.record_firework_import_dispatch_result(uuid, text, integer, text, text)
  to service_role;

comment on table public.import_runs is
  'Immutable processing attempts for a firework video import. Direct dispatch and executor provenance are recorded separately, while lease fields prevent stale workers from winning.';
