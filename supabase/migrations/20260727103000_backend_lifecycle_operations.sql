-- Durable cue generation, operational dead letters, and private audio retention.

create table if not exists public.backend_dead_letters (
  id uuid primary key default gen_random_uuid(),
  work_type text not null,
  work_key text not null,
  user_id uuid references auth.users(id) on delete set null,
  severity text not null default 'error',
  reason text not null,
  attempt_count integer not null default 0,
  occurrence_count integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'open',
  first_observed_at timestamptz not null default now(),
  last_observed_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution_note text,
  constraint backend_dead_letters_work_type_check
    check (work_type in ('song_analysis', 'cue_generation', 'audio_cleanup')),
  constraint backend_dead_letters_severity_check
    check (severity in ('warning', 'error', 'critical')),
  constraint backend_dead_letters_status_check
    check (status in ('open', 'resolved', 'ignored')),
  constraint backend_dead_letters_attempt_count_check check (attempt_count >= 0),
  constraint backend_dead_letters_occurrence_count_check check (occurrence_count > 0),
  constraint backend_dead_letters_work_unique unique (work_type, work_key)
);

create index if not exists backend_dead_letters_open_last_observed_idx
  on public.backend_dead_letters (last_observed_at desc)
  where status = 'open';

alter table public.backend_dead_letters enable row level security;
create policy backend_dead_letters_service_role_manage
  on public.backend_dead_letters
  for all
  to service_role
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
revoke all on public.backend_dead_letters from public, anon, authenticated;
revoke delete, truncate, references, trigger on public.backend_dead_letters from service_role;
grant select, insert, update on public.backend_dead_letters to service_role;

create or replace function private.upsert_backend_dead_letter(
  p_work_type text,
  p_work_key text,
  p_user_id uuid,
  p_severity text,
  p_reason text,
  p_attempt_count integer,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_work_type not in ('song_analysis', 'cue_generation', 'audio_cleanup')
    or p_severity not in ('warning', 'error', 'critical')
    or nullif(btrim(p_work_key), '') is null
    or nullif(btrim(p_reason), '') is null
    or p_attempt_count < 0 then
    raise exception 'Invalid backend dead-letter payload.' using errcode = '22023';
  end if;

  insert into public.backend_dead_letters (
    work_type,
    work_key,
    user_id,
    severity,
    reason,
    attempt_count,
    metadata
  ) values (
    p_work_type,
    left(btrim(p_work_key), 500),
    p_user_id,
    p_severity,
    left(btrim(p_reason), 2000),
    p_attempt_count,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (work_type, work_key) do update
  set user_id = excluded.user_id,
      severity = excluded.severity,
      reason = excluded.reason,
      attempt_count = greatest(
        public.backend_dead_letters.attempt_count,
        excluded.attempt_count
      ),
      occurrence_count = public.backend_dead_letters.occurrence_count + 1,
      metadata = public.backend_dead_letters.metadata || excluded.metadata,
      status = 'open',
      last_observed_at = now(),
      resolved_at = null,
      resolution_note = null;
end;
$$;

revoke execute on function private.upsert_backend_dead_letter(
  text, text, uuid, text, text, integer, jsonb
) from public, anon, authenticated, service_role;

create or replace function private.record_exhausted_song_analysis_dead_letter()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'running'
    and new.status = 'failed'
    and new.attempt_count >= 3 then
    perform private.upsert_backend_dead_letter(
      'song_analysis',
      new.id::text,
      new.user_id,
      'error',
      coalesce(new.error_message, 'Song analysis exhausted its retry attempts.'),
      new.attempt_count,
      jsonb_build_object('terminalReason', 'retry_exhausted')
    );
  end if;
  return new;
end;
$$;

revoke execute on function private.record_exhausted_song_analysis_dead_letter()
  from public, anon, authenticated, service_role;

drop trigger if exists record_exhausted_song_analysis_dead_letter
  on public.song_analyses;
create trigger record_exhausted_song_analysis_dead_letter
after update of status on public.song_analyses
for each row
execute function private.record_exhausted_song_analysis_dead_letter();

create or replace function public.record_backend_dead_letter(
  p_work_type text,
  p_work_key text,
  p_user_id uuid,
  p_severity text,
  p_reason text,
  p_attempt_count integer,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only a lifecycle worker may record backend dead letters.'
      using errcode = '42501';
  end if;
  perform private.upsert_backend_dead_letter(
    p_work_type,
    p_work_key,
    p_user_id,
    p_severity,
    p_reason,
    p_attempt_count,
    p_metadata
  );
end;
$$;

revoke execute on function public.record_backend_dead_letter(
  text, text, uuid, text, text, integer, jsonb
) from public, anon, authenticated;
grant execute on function public.record_backend_dead_letter(
  text, text, uuid, text, text, integer, jsonb
) to service_role;

alter table public.shows
  add column if not exists generation_attempt_count integer not null default 0,
  add column if not exists generation_lease_token uuid,
  add column if not exists generation_lease_expires_at timestamptz,
  add column if not exists generation_last_attempt_at timestamptz,
  add column if not exists generation_next_retry_at timestamptz,
  add column if not exists generation_runtime_ms integer;

alter table public.shows
  drop constraint if exists shows_generation_attempt_count_check,
  add constraint shows_generation_attempt_count_check
    check (generation_attempt_count between 0 and 3),
  drop constraint if exists shows_generation_lease_pair_check,
  add constraint shows_generation_lease_pair_check
    check (
      (generation_lease_token is null) =
      (generation_lease_expires_at is null)
    ),
  drop constraint if exists shows_generation_runtime_ms_check,
  add constraint shows_generation_runtime_ms_check
    check (generation_runtime_ms is null or generation_runtime_ms >= 0);

create index if not exists shows_generation_retry_claim_idx
  on public.shows (
    coalesce(generation_next_retry_at, generation_started_at, created_at),
    generation_lease_expires_at,
    created_at
  )
  where generation_status = 'running';

create or replace function public.claim_cue_generation_attempt(
  p_show_id uuid default null,
  p_lease_seconds integer default 900,
  p_max_attempts integer default 3
)
returns table (
  show_id uuid,
  user_id uuid,
  music_analysis_id uuid,
  selected_cue_model text,
  show_style text,
  credit_action_key text,
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
  show_row public.shows;
  reservation_action text;
  claimed_token uuid := gen_random_uuid();
begin
  if p_lease_seconds not between 60 and 1200
    or p_max_attempts not between 1 and 3 then
    raise exception 'Invalid cue generation lease settings.' using errcode = '22023';
  end if;
  if caller_role <> 'service_role' and (
    caller_id is null
    or p_show_id is null
    or not coalesce(public.current_user_is_active(), false)
  ) then
    raise exception 'You do not have permission to claim cue generation work.'
      using errcode = '42501';
  end if;

  select show_record.* into show_row
  from public.shows show_record
  where show_record.generation_status = 'running'
    and show_record.generation_attempt_count < p_max_attempts
    and (p_show_id is null or show_record.id = p_show_id)
    and (caller_role = 'service_role' or show_record.user_id = caller_id)
    and (
      show_record.generation_next_retry_at is null
      or show_record.generation_next_retry_at <= now()
    )
    and (
      show_record.generation_lease_expires_at is null
      or show_record.generation_lease_expires_at <= now()
    )
    and (
      show_record.music_analysis_id is null
      or exists (
        select 1
        from public.song_analyses analysis
        where analysis.id = show_record.music_analysis_id
          and analysis.user_id = show_record.user_id
          and analysis.status in ('completed', 'failed')
      )
    )
    and exists (
      select 1
      from public.ai_credit_transactions reservation
      where reservation.user_id = show_record.user_id
        and reservation.transaction_type = 'reserve'
        and reservation.status = 'reserved'
        and reservation.reference_type = 'shows'
        and reservation.reference_id = show_record.id
        and reservation.idempotency_key =
          'show-generation:' || show_record.id::text || ':reserve'
    )
  order by coalesce(
    show_record.generation_next_retry_at,
    show_record.generation_started_at,
    show_record.created_at
  )
  limit 1
  for update skip locked;

  if not found then
    return;
  end if;

  select reservation.action_key into reservation_action
  from public.ai_credit_transactions reservation
  where reservation.user_id = show_row.user_id
    and reservation.transaction_type = 'reserve'
    and reservation.status = 'reserved'
    and reservation.reference_type = 'shows'
    and reservation.reference_id = show_row.id
    and reservation.idempotency_key =
      'show-generation:' || show_row.id::text || ':reserve';

  perform set_config('showcrafter.cue_lifecycle_write', '1', true);
  update public.shows
  set generation_attempt_count = show_row.generation_attempt_count + 1,
      generation_lease_token = claimed_token,
      generation_lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      generation_last_attempt_at = now(),
      generation_next_retry_at = null,
      generation_error = null
  where id = show_row.id;

  return query
  select
    show_row.id,
    show_row.user_id,
    show_row.music_analysis_id,
    show_row.selected_cue_model,
    show_row.show_style,
    reservation_action,
    show_row.generation_attempt_count + 1,
    claimed_token;
end;
$$;

revoke execute on function public.claim_cue_generation_attempt(uuid, integer, integer)
  from public, anon;
grant execute on function public.claim_cue_generation_attempt(uuid, integer, integer)
  to authenticated, service_role;

create or replace function public.schedule_cue_generation_retry(
  p_show_id uuid,
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
  if p_runtime_ms < 0 or p_retry_delay_seconds not between 5 and 900 then
    raise exception 'Invalid cue generation retry settings.' using errcode = '22023';
  end if;
  if caller_role <> 'service_role' and (
    caller_id is null
    or not coalesce(public.current_user_is_active(), false)
  ) then
    raise exception 'You do not have permission to retry cue generation work.'
      using errcode = '42501';
  end if;

  perform set_config('showcrafter.cue_lifecycle_write', '1', true);
  update public.shows show_record
  set generation_lease_token = null,
      generation_lease_expires_at = null,
      generation_next_retry_at = now() + make_interval(secs => p_retry_delay_seconds),
      generation_runtime_ms = p_runtime_ms,
      generation_error = left(coalesce(p_error_message, 'Retry scheduled'), 2000)
  where show_record.id = p_show_id
    and show_record.generation_status = 'running'
    and show_record.generation_lease_token = p_lease_token
    and show_record.generation_lease_expires_at > now()
    and (
      caller_role = 'service_role'
      or show_record.user_id = caller_id
    );
  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;

revoke execute on function public.schedule_cue_generation_retry(
  uuid, uuid, text, integer, integer
) from public, anon;
grant execute on function public.schedule_cue_generation_retry(
  uuid, uuid, text, integer, integer
) to authenticated, service_role;

create or replace function public.complete_cue_generation_attempt(
  p_show_id uuid,
  p_lease_token uuid,
  p_cue_count integer,
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
  show_row public.shows;
  stored_cue_count integer;
begin
  if p_cue_count <= 0 or p_runtime_ms < 0 then
    raise exception 'Invalid cue generation completion payload.' using errcode = '22023';
  end if;
  if caller_role <> 'service_role' and (
    caller_id is null
    or not coalesce(public.current_user_is_active(), false)
  ) then
    raise exception 'You do not have permission to complete cue generation work.'
      using errcode = '42501';
  end if;

  select show_record.* into show_row
  from public.shows show_record
  where show_record.id = p_show_id
    and show_record.generation_status = 'running'
    and show_record.generation_lease_token = p_lease_token
    and show_record.generation_lease_expires_at > now()
    and (
      caller_role = 'service_role'
      or show_record.user_id = caller_id
    )
  for update;
  if not found then
    return false;
  end if;

  select count(*)::integer into stored_cue_count
  from public.show_timeline_items item
  where item.show_id = show_row.id;
  if stored_cue_count <> p_cue_count then
    raise exception 'Stored cue count does not match the completion payload.'
      using errcode = '55000';
  end if;

  perform set_config('showcrafter.cue_lifecycle_write', '1', true);
  update public.shows
  set generation_status = 'completed',
      generation_error = null,
      generated_cue_count = p_cue_count,
      generation_completed_at = now(),
      generation_runtime_ms = p_runtime_ms,
      generation_lease_token = null,
      generation_lease_expires_at = null,
      generation_next_retry_at = null
  where id = show_row.id;

  perform private.resolve_known_ai_credit(
    show_row.user_id,
    'show-generation:' || show_row.id::text || ':reserve',
    'shows',
    show_row.id,
    'settled',
    'Cue generation completed'
  );
  return true;
end;
$$;

revoke execute on function public.complete_cue_generation_attempt(
  uuid, uuid, integer, integer
) from public, anon;
grant execute on function public.complete_cue_generation_attempt(
  uuid, uuid, integer, integer
) to authenticated, service_role;

create or replace function public.fail_cue_generation_attempt(
  p_show_id uuid,
  p_lease_token uuid,
  p_error_message text,
  p_runtime_ms integer,
  p_dead_letter boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_role text := auth.role();
  show_row public.shows;
  failure_message text := left(
    coalesce(nullif(btrim(p_error_message), ''), 'Cue generation failed'),
    2000
  );
begin
  if p_runtime_ms < 0 then
    raise exception 'Invalid cue generation runtime.' using errcode = '22023';
  end if;
  if caller_role <> 'service_role' and (
    caller_id is null
    or not coalesce(public.current_user_is_active(), false)
  ) then
    raise exception 'You do not have permission to fail cue generation work.'
      using errcode = '42501';
  end if;

  select show_record.* into show_row
  from public.shows show_record
  where show_record.id = p_show_id
    and show_record.generation_status = 'running'
    and show_record.generation_lease_token = p_lease_token
    and show_record.generation_lease_expires_at > now()
    and (
      caller_role = 'service_role'
      or show_record.user_id = caller_id
    )
  for update;
  if not found then
    return false;
  end if;

  perform set_config('showcrafter.cue_lifecycle_write', '1', true);
  update public.shows
  set generation_status = 'failed',
      generation_error = failure_message,
      generation_completed_at = now(),
      generation_runtime_ms = p_runtime_ms,
      generation_lease_token = null,
      generation_lease_expires_at = null,
      generation_next_retry_at = null
  where id = show_row.id;

  perform private.resolve_known_ai_credit(
    show_row.user_id,
    'show-generation:' || show_row.id::text || ':reserve',
    'shows',
    show_row.id,
    'refunded',
    failure_message
  );

  if p_dead_letter then
    perform private.upsert_backend_dead_letter(
      'cue_generation',
      show_row.id::text,
      show_row.user_id,
      'error',
      failure_message,
      show_row.generation_attempt_count,
      jsonb_build_object('terminalReason', 'retry_exhausted')
    );
  end if;
  return true;
end;
$$;

revoke execute on function public.fail_cue_generation_attempt(
  uuid, uuid, text, integer, boolean
) from public, anon;
grant execute on function public.fail_cue_generation_attempt(
  uuid, uuid, text, integer, boolean
) to authenticated, service_role;

create or replace function public.fail_waiting_show_generation(
  p_show_id uuid,
  p_error_message text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_role text := auth.role();
  show_row public.shows;
  failure_message text := left(
    coalesce(nullif(btrim(p_error_message), ''), 'Music analysis failed'),
    2000
  );
begin
  if caller_role <> 'service_role' and (
    caller_id is null
    or not coalesce(public.current_user_is_active(), false)
  ) then
    raise exception 'You do not have permission to fail waiting show generation.'
      using errcode = '42501';
  end if;

  select show_record.* into show_row
  from public.shows show_record
  where show_record.id = p_show_id
    and show_record.generation_status = 'running'
    and (
      show_record.generation_lease_expires_at is null
      or show_record.generation_lease_expires_at <= now()
    )
    and (
      caller_role = 'service_role'
      or show_record.user_id = caller_id
    )
    and exists (
      select 1
      from public.song_analyses analysis
      where analysis.id = show_record.music_analysis_id
        and analysis.user_id = show_record.user_id
        and analysis.status = 'failed'
    )
  for update;
  if not found then
    return false;
  end if;

  perform set_config('showcrafter.cue_lifecycle_write', '1', true);
  update public.shows
  set generation_status = 'failed',
      generation_error = failure_message,
      generation_completed_at = now(),
      generation_lease_token = null,
      generation_lease_expires_at = null,
      generation_next_retry_at = null
  where id = show_row.id;

  perform private.resolve_known_ai_credit(
    show_row.user_id,
    'show-generation:' || show_row.id::text || ':reserve',
    'shows',
    show_row.id,
    'refunded',
    failure_message
  );
  return true;
end;
$$;

revoke execute on function public.fail_waiting_show_generation(uuid, text)
  from public, anon;
grant execute on function public.fail_waiting_show_generation(uuid, text)
  to authenticated, service_role;

create or replace function public.expire_exhausted_cue_generations(
  p_limit integer default 10,
  p_max_attempts integer default 3
)
returns table (
  show_id uuid,
  user_id uuid,
  error_message text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  show_row public.shows;
  failure_message text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only the reconciliation worker may expire cue generation.'
      using errcode = '42501';
  end if;
  if p_limit not between 1 and 50 or p_max_attempts not between 1 and 3 then
    raise exception 'Invalid cue generation expiry settings.' using errcode = '22023';
  end if;

  for show_row in
    select show_record.*
    from public.shows show_record
    where show_record.generation_status = 'running'
      and show_record.generation_attempt_count >= p_max_attempts
      and (
        show_record.generation_next_retry_at is null
        or show_record.generation_next_retry_at <= now()
      )
      and (
        show_record.generation_lease_expires_at is null
        or show_record.generation_lease_expires_at <= now()
      )
    order by coalesce(
      show_record.generation_lease_expires_at,
      show_record.generation_next_retry_at,
      show_record.generation_started_at,
      show_record.created_at
    )
    limit p_limit
    for update skip locked
  loop
    failure_message := left(
      coalesce(
        nullif(btrim(show_row.generation_error), ''),
        'Cue generation stopped before completing its final attempt.'
      ),
      2000
    );

    perform set_config('showcrafter.cue_lifecycle_write', '1', true);
    update public.shows
    set generation_status = 'failed',
        generation_error = failure_message,
        generation_completed_at = now(),
        generation_lease_token = null,
        generation_lease_expires_at = null,
        generation_next_retry_at = null
    where id = show_row.id;

    perform private.resolve_known_ai_credit(
      show_row.user_id,
      'show-generation:' || show_row.id::text || ':reserve',
      'shows',
      show_row.id,
      'refunded',
      failure_message
    );
    perform private.upsert_backend_dead_letter(
      'cue_generation',
      show_row.id::text,
      show_row.user_id,
      'error',
      failure_message,
      show_row.generation_attempt_count,
      jsonb_build_object('terminalReason', 'stale_lease_exhausted')
    );

    show_id := show_row.id;
    user_id := show_row.user_id;
    error_message := failure_message;
    return next;
  end loop;
end;
$$;

revoke execute on function public.expire_exhausted_cue_generations(integer, integer)
  from public, anon, authenticated;
grant execute on function public.expire_exhausted_cue_generations(integer, integer)
  to service_role;

create or replace function public.purge_expired_song_analyses(
  p_limit integer default 25,
  p_retention_days integer default 7
)
returns table (
  analysis_id uuid,
  user_id uuid,
  audio_path text,
  analysis_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  analysis_row public.song_analyses;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only the retention worker may purge song analyses.'
      using errcode = '42501';
  end if;
  if p_limit not between 1 and 100 or p_retention_days not between 1 and 365 then
    raise exception 'Invalid song analysis retention settings.' using errcode = '22023';
  end if;

  for analysis_row in
    select analysis.*
    from public.song_analyses analysis
    where analysis.status in ('completed', 'failed')
      and coalesce(analysis.completed_at, analysis.created_at)
        <= now() - make_interval(days => p_retention_days)
      and not exists (
        select 1
        from public.shows show_record
        where show_record.music_analysis_id = analysis.id
           or show_record.audio_path = analysis.audio_path
      )
      and exists (
        select 1
        from public.ai_credit_transactions reservation
        where reservation.user_id = analysis.user_id
          and reservation.transaction_type = 'reserve'
          and reservation.reference_type = 'song_analyses'
          and reservation.reference_id = analysis.id
          and reservation.idempotency_key =
            'music-analysis:' || analysis.id::text || ':reserve'
          and (
            (analysis.status = 'completed' and reservation.status = 'settled')
            or (analysis.status = 'failed' and reservation.status = 'refunded')
          )
      )
    order by coalesce(analysis.completed_at, analysis.created_at)
    limit p_limit
    for update skip locked
  loop
    delete from public.song_analyses
    where id = analysis_row.id;

    analysis_id := analysis_row.id;
    user_id := analysis_row.user_id;
    audio_path := analysis_row.audio_path;
    analysis_status := analysis_row.status;
    return next;
  end loop;
end;
$$;

revoke execute on function public.purge_expired_song_analyses(integer, integer)
  from public, anon, authenticated;
grant execute on function public.purge_expired_song_analyses(integer, integer)
  to service_role;

create or replace function public.list_orphan_audio_objects(
  p_limit integer default 25,
  p_grace_hours integer default 24
)
returns table (audio_path text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only the retention worker may inspect orphan audio.'
      using errcode = '42501';
  end if;
  if p_limit not between 1 and 100 or p_grace_hours not between 1 and 720 then
    raise exception 'Invalid orphan audio retention settings.' using errcode = '22023';
  end if;

  return query
  select object.name
  from storage.objects object
  where object.bucket_id = 'audio'
    and object.created_at <= now() - make_interval(hours => p_grace_hours)
    and object.name ~ '^[0-9a-fA-F-]{36}/[^/]+$'
    and not exists (
      select 1
      from public.song_analyses analysis
      where analysis.audio_path = object.name
    )
    and not exists (
      select 1
      from public.shows show_record
      where show_record.audio_path = object.name
    )
  order by object.created_at
  limit p_limit;
end;
$$;

revoke execute on function public.list_orphan_audio_objects(integer, integer)
  from public, anon, authenticated;
grant execute on function public.list_orphan_audio_objects(integer, integer)
  to service_role;

create or replace function public.get_backend_lifecycle_health()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only a lifecycle worker may inspect backend health.'
      using errcode = '42501';
  end if;

  select jsonb_build_object(
    'checkedAt', now(),
    'songAnalysis', jsonb_build_object(
      'running', (
        select count(*) from public.song_analyses where status = 'running'
      ),
      'retryWaiting', (
        select count(*) from public.song_analyses
        where status = 'running' and next_retry_at > now()
      ),
      'staleLeases', (
        select count(*) from public.song_analyses
        where status = 'running' and lease_expires_at <= now()
      ),
      'failed24h', (
        select count(*) from public.song_analyses
        where status = 'failed' and completed_at >= now() - interval '24 hours'
      )
    ),
    'cueGeneration', jsonb_build_object(
      'running', (
        select count(*) from public.shows where generation_status = 'running'
      ),
      'retryWaiting', (
        select count(*) from public.shows
        where generation_status = 'running' and generation_next_retry_at > now()
      ),
      'staleLeases', (
        select count(*) from public.shows
        where generation_status = 'running' and generation_lease_expires_at <= now()
      ),
      'failed24h', (
        select count(*) from public.shows
        where generation_status = 'failed'
          and generation_completed_at >= now() - interval '24 hours'
      )
    ),
    'deadLetters', jsonb_build_object(
      'open', (
        select count(*) from public.backend_dead_letters where status = 'open'
      ),
      'critical', (
        select count(*) from public.backend_dead_letters
        where status = 'open' and severity = 'critical'
      ),
      'oldestOpenAt', (
        select min(first_observed_at) from public.backend_dead_letters where status = 'open'
      )
    )
  ) into result;

  return result;
end;
$$;

revoke execute on function public.get_backend_lifecycle_health()
  from public, anon, authenticated;
grant execute on function public.get_backend_lifecycle_health()
  to service_role;

create or replace function public.resolve_backend_dead_letter(
  p_dead_letter_id uuid,
  p_status text,
  p_resolution_note text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_rows integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only a lifecycle operator may resolve backend dead letters.'
      using errcode = '42501';
  end if;
  if p_status not in ('resolved', 'ignored')
    or nullif(btrim(p_resolution_note), '') is null then
    raise exception 'Invalid dead-letter resolution.' using errcode = '22023';
  end if;

  update public.backend_dead_letters
  set status = p_status,
      resolved_at = now(),
      resolution_note = left(btrim(p_resolution_note), 1000)
  where id = p_dead_letter_id
    and status = 'open';
  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;

revoke execute on function public.resolve_backend_dead_letter(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.resolve_backend_dead_letter(uuid, text, text)
  to service_role;

comment on table public.backend_dead_letters is
  'Operational records for exhausted or repeatedly failing asynchronous backend work.';
comment on column public.shows.generation_lease_token is
  'Opaque write-fencing token for the active cue-generation worker.';
comment on column public.shows.generation_next_retry_at is
  'Earliest time a transient cue-generation failure may be claimed again.';
