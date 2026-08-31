-- Durable leases and bounded retry recovery for upload-scoped song analysis.

alter table public.song_analyses
  add column if not exists attempt_count integer not null default 0,
  add column if not exists lease_token uuid,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists next_retry_at timestamptz;

alter table public.song_analyses
  drop constraint if exists song_analyses_attempt_count_check,
  add constraint song_analyses_attempt_count_check
    check (attempt_count between 0 and 3),
  drop constraint if exists song_analyses_lease_pair_check,
  add constraint song_analyses_lease_pair_check
    check ((lease_token is null) = (lease_expires_at is null));

create index if not exists song_analyses_retry_claim_idx
  on public.song_analyses (
    coalesce(next_retry_at, created_at),
    lease_expires_at,
    created_at
  )
  where status = 'running';

-- Lifecycle writes must pass through the token-fenced functions below.
-- Direct deletion would also bypass the guarded credit and storage cleanup.
revoke update, delete on public.song_analyses from authenticated;

-- This helper is callable only from the narrow lifecycle functions below. It
-- resolves one known reservation while holding both ledger and account locks.
create or replace function private.resolve_known_ai_credit(
  p_user_id uuid,
  p_reservation_key text,
  p_reference_type text,
  p_reference_id uuid,
  p_outcome text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation_row public.ai_credit_transactions;
  account_row public.ai_credit_accounts;
  resolution_type text;
  resolution_key text;
begin
  if p_outcome not in ('settled', 'refunded') then
    raise exception 'Invalid credit outcome.' using errcode = '22023';
  end if;

  select transaction.* into reservation_row
  from public.ai_credit_transactions transaction
  where transaction.idempotency_key = p_reservation_key
    and transaction.user_id = p_user_id
    and transaction.transaction_type = 'reserve'
    and transaction.reference_type = p_reference_type
    and transaction.reference_id = p_reference_id
  for update;
  if not found then
    raise exception 'The expected credit reservation was not found.' using errcode = '55000';
  end if;

  if reservation_row.status = p_outcome then
    return;
  end if;
  if reservation_row.status <> 'reserved' then
    raise exception 'The credit reservation was already resolved differently.'
      using errcode = '55000';
  end if;

  select account.* into account_row
  from public.ai_credit_accounts account
  where account.user_id = p_user_id
  for update;
  if not found then
    raise exception 'The credit account was not found.' using errcode = '55000';
  end if;

  if p_outcome = 'settled' then
    update public.ai_credit_accounts
    set reserved = reserved - reservation_row.amount,
        balance = balance - reservation_row.amount
    where user_id = p_user_id
      and reserved >= reservation_row.amount
      and balance >= reservation_row.amount
    returning * into account_row;
    resolution_type := 'debit';
    resolution_key := p_reservation_key || ':debit';
  else
    update public.ai_credit_accounts
    set reserved = reserved - reservation_row.amount
    where user_id = p_user_id
      and reserved >= reservation_row.amount
    returning * into account_row;
    resolution_type := 'refund';
    resolution_key := p_reservation_key || ':refund';
  end if;
  if not found then
    raise exception 'The credit reservation could not be resolved.' using errcode = '55000';
  end if;

  update public.ai_credit_transactions
  set status = p_outcome,
      balance_after = account_row.balance,
      reserved_after = account_row.reserved
  where id = reservation_row.id;

  insert into public.ai_credit_transactions (
    user_id,
    transaction_type,
    status,
    action_key,
    amount,
    balance_after,
    reserved_after,
    reference_type,
    reference_id,
    idempotency_key,
    related_transaction_id,
    metadata,
    created_by
  ) values (
    p_user_id,
    resolution_type,
    'applied',
    reservation_row.action_key,
    reservation_row.amount,
    account_row.balance,
    account_row.reserved,
    reservation_row.reference_type,
    reservation_row.reference_id,
    resolution_key,
    reservation_row.id,
    jsonb_build_object(
      'reason', left(coalesce(nullif(btrim(p_reason), ''), 'Background work resolved'), 500)
    ),
    p_user_id
  );
end;
$$;

revoke execute on function private.resolve_known_ai_credit(
  uuid, text, text, uuid, text, text
) from public, anon, authenticated, service_role;

create or replace function private.resolve_song_analysis_credit(
  p_analysis_id uuid,
  p_outcome text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  analysis_row public.song_analyses;
begin
  select analysis.* into analysis_row
  from public.song_analyses analysis
  where analysis.id = p_analysis_id
  for update;
  if not found then
    raise exception 'Song analysis not found.' using errcode = 'P0002';
  end if;

  perform private.resolve_known_ai_credit(
    analysis_row.user_id,
    'music-analysis:' || analysis_row.id::text || ':reserve',
    'song_analyses',
    analysis_row.id,
    p_outcome,
    p_reason
  );
end;
$$;

revoke execute on function private.resolve_song_analysis_credit(uuid, text, text)
  from public, anon, authenticated, service_role;

create or replace function public.claim_song_analysis_attempt(
  p_analysis_id uuid default null,
  p_lease_seconds integer default 900,
  p_max_attempts integer default 3
)
returns table (
  analysis_id uuid,
  user_id uuid,
  audio_path text,
  personality text,
  attempt_count integer,
  lease_token uuid
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
begin
  if p_lease_seconds not between 60 and 1200
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
    and analysis.attempt_count < p_max_attempts
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

  update public.song_analyses
  set attempt_count = analysis_row.attempt_count + 1,
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
    analysis_row.attempt_count + 1,
    claimed_token;
end;
$$;

revoke execute on function public.claim_song_analysis_attempt(uuid, integer, integer)
  from public, anon;
grant execute on function public.claim_song_analysis_attempt(uuid, integer, integer)
  to authenticated, service_role;

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
  if p_retry_delay_seconds not between 5 and 900
    or p_runtime_ms < 0 then
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
      next_retry_at = now() + make_interval(secs => p_retry_delay_seconds),
      runtime_ms = p_runtime_ms,
      error_message = left(coalesce(p_error_message, 'Retry scheduled'), 2000)
  where analysis.id = p_analysis_id
    and analysis.status = 'running'
    and analysis.lease_token = p_lease_token
    and analysis.lease_expires_at > now()
    and (
      caller_role = 'service_role'
      or (
        caller_id = analysis.user_id
        and coalesce(public.current_user_is_active(), false)
      )
    );
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
    and (
      caller_role = 'service_role'
      or (
        caller_id = analysis.user_id
        and coalesce(public.current_user_is_active(), false)
      )
    )
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
      next_retry_at = null
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
  failure_message text := left(coalesce(nullif(btrim(p_error_message), ''), 'Song analysis failed'), 2000);
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
    and (
      caller_role = 'service_role'
      or (
        caller_id = analysis.user_id
        and coalesce(public.current_user_is_active(), false)
      )
    )
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
      next_retry_at = null
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
  if p_limit not between 1 and 50
    or p_max_attempts not between 1 and 3 then
    raise exception 'Invalid song analysis expiry settings.' using errcode = '22023';
  end if;

  for analysis_row in
    select analysis.*
    from public.song_analyses analysis
    where analysis.status = 'running'
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

-- Cue generation can resume under the reconciliation worker after an analysis
-- succeeds. This wrapper resolves only the reservation belonging to a show
-- whose terminal generation state has already been persisted.
create or replace function public.resolve_reconciled_show_generation_credit(
  p_show_id uuid,
  p_outcome text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  show_row public.shows;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only the reconciliation worker may resolve show credits.'
      using errcode = '42501';
  end if;
  if p_outcome not in ('settled', 'refunded') then
    raise exception 'Invalid show credit outcome.' using errcode = '22023';
  end if;

  select show_record.* into show_row
  from public.shows show_record
  where show_record.id = p_show_id
  for update;
  if not found then
    raise exception 'Show not found.' using errcode = 'P0002';
  end if;
  if (p_outcome = 'settled' and show_row.generation_status <> 'completed')
    or (p_outcome = 'refunded' and show_row.generation_status <> 'failed') then
    raise exception 'The show is not in the expected terminal state.' using errcode = '55000';
  end if;

  perform private.resolve_known_ai_credit(
    show_row.user_id,
    'show-generation:' || show_row.id::text || ':reserve',
    'shows',
    show_row.id,
    p_outcome,
    p_reason
  );
end;
$$;

revoke execute on function public.resolve_reconciled_show_generation_credit(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.resolve_reconciled_show_generation_credit(uuid, text, text)
  to service_role;

comment on column public.song_analyses.attempt_count is
  'Number of claimed analyser attempts. Automatic recovery is capped at three.';
comment on column public.song_analyses.lease_token is
  'Opaque write-fencing token for the active analyser worker.';
comment on column public.song_analyses.lease_expires_at is
  'Deadline after which reconciliation may recover work from a stale worker.';
comment on column public.song_analyses.next_retry_at is
  'Earliest time a transient analyser failure may be claimed again.';
