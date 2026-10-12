-- Remove schema that nothing reads. Each drop was checked against the web app,
-- workers, scripts and SQL functions; the two claim functions below are
-- unchanged apart from no longer writing the dropped attempt timestamps.
begin;

-- Assortment allowance comes from show_assortment_items; nothing has used
-- these rows since the app stopped reading them. Refuse to drop live data.
do $guard$
begin
  if exists (select 1 from public.show_assortment_selections) then
    raise exception 'show_assortment_selections still has rows; review them before dropping the table';
  end if;
end
$guard$;
drop table public.show_assortment_selections;

CREATE OR REPLACE FUNCTION "public"."claim_cue_generation_attempt"("p_show_id" "uuid" DEFAULT NULL::"uuid", "p_lease_seconds" integer DEFAULT 900, "p_max_attempts" integer DEFAULT 3) RETURNS TABLE("show_id" "uuid", "user_id" "uuid", "music_analysis_id" "uuid", "selected_cue_model" "text", "show_style" "text", "credit_action_key" "text", "attempt_count" integer, "lease_token" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

CREATE OR REPLACE FUNCTION "public"."claim_song_analysis_attempt"("p_analysis_id" "uuid" DEFAULT NULL::"uuid", "p_lease_seconds" integer DEFAULT 900, "p_max_attempts" integer DEFAULT 3) RETURNS TABLE("analysis_id" "uuid", "user_id" "uuid", "audio_path" "text", "personality" "text", "attempt_count" integer, "lease_token" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

alter table public.shows drop column generation_last_attempt_at;
alter table public.song_analyses drop column last_attempt_at;
-- Never written by any caller, so always null.
alter table public.show_generation_runs drop column cue_count;
-- Never read or written outside the bootstrap snapshot.
alter table public.supplier_inventory_items drop column quantity_on_hand;

-- Unused allowed values. Adding the narrower constraint fails if a row still
-- uses a removed value. vdl_glossary stays for the planned VDL import.
alter table public.import_jobs drop constraint import_jobs_kind_check;
alter table public.import_jobs add constraint import_jobs_kind_check
  check (kind = any (array['vdl_glossary'::text, 'firework_video'::text]));
alter table public.media_assets drop constraint media_assets_source_type_check;
alter table public.media_assets add constraint media_assets_source_type_check
  check (source_type = 'upload'::text);

comment on column public.import_jobs.approved_catalogue_item_id is
  'Canonical catalogue item approved from an import job.';

commit;
