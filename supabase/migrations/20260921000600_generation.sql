-- ShowCrafter baseline: generation.
set check_function_bodies = false;

CREATE OR REPLACE FUNCTION "private"."ai_credit_usage_payload"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_account public.ai_credit_accounts%rowtype;
  v_hourly_limit integer := 20;
  v_weekly_limit integer := 150;
  v_hourly_used integer := 0;
  v_weekly_used integer := 0;
  v_hourly_remaining integer := 0;
  v_weekly_remaining integer := 0;
  v_total_granted integer := 0;
  v_total_spent integer := 0;
  v_wallet_available integer := 0;
begin
  select * into v_account
  from public.ai_credit_accounts
  where user_id = p_user_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'AI credit account was not found.');
  end if;

  select coalesce(sum(amount), 0)::integer into v_total_granted
  from public.ai_credit_transactions
  where user_id = p_user_id
    and transaction_type = 'grant'
    and status = 'applied';

  select coalesce(sum(amount), 0)::integer into v_total_spent
  from public.ai_credit_transactions
  where user_id = p_user_id
    and transaction_type = 'debit'
    and status = 'applied';

  select coalesce(sum(amount), 0)::integer into v_hourly_used
  from public.ai_credit_transactions
  where user_id = p_user_id
    and transaction_type = 'debit'
    and status = 'applied'
    and created_at >= date_trunc('hour', now());

  select coalesce(sum(amount), 0)::integer into v_weekly_used
  from public.ai_credit_transactions
  where user_id = p_user_id
    and transaction_type = 'debit'
    and status = 'applied'
    and created_at >= date_trunc('week', now());

  v_wallet_available := greatest(v_account.balance - v_account.reserved, 0);
  v_hourly_remaining := greatest(v_hourly_limit - v_hourly_used - v_account.reserved, 0);
  v_weekly_remaining := greatest(v_weekly_limit - v_weekly_used - v_account.reserved, 0);

  return jsonb_build_object(
    'ok', true,
    'balance', v_account.balance,
    'reserved', v_account.reserved,
    'available', least(v_wallet_available, v_hourly_remaining, v_weekly_remaining),
    'includedCredits', 150,
    'hourlyLimit', v_hourly_limit,
    'weeklyLimit', v_weekly_limit,
    'hourlyUsed', v_hourly_used,
    'weeklyUsed', v_weekly_used,
    'hourlyRemaining', v_hourly_remaining,
    'weeklyRemaining', v_weekly_remaining,
    'hourlyResetAt', date_trunc('hour', now()) + interval '1 hour',
    'weeklyResetAt', date_trunc('week', now()) + interval '1 week',
    'totalGranted', v_total_granted,
    'totalSpent', v_total_spent
  );
end;
$$;

ALTER FUNCTION "private"."ai_credit_usage_payload"("p_user_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."enforce_supported_song_analysis_source_licence"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $_$
begin
  if new.source_provider = 'jamendo'
    and (
      new.source_licence_name is null
      or new.source_licence_url is null
      or new.source_licence_name !~ '^(CC BY|CC0) [0-9]+(\.[0-9]+)?$'
      or new.source_licence_url !~ '^https://creativecommons\.org/(licenses/by|publicdomain/zero)/[0-9]+(\.[0-9]+)?/$'
    )
  then
    raise exception 'Unsupported Jamendo soundtrack licence.'
      using
        errcode = '23514',
        constraint = 'song_analyses_supported_source_licence_check';
  end if;

  return new;
end;
$_$;

ALTER FUNCTION "private"."enforce_supported_song_analysis_source_licence"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."ensure_ai_credit_account"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_account public.ai_credit_accounts%rowtype;
  v_grant_amount integer := 150;
  v_grant_key text;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'Missing user id.');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('ai-credit-account:' || p_user_id::text, 0));

  insert into public.ai_credit_accounts (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  v_grant_key := 'default-preview-credit-grant:' || p_user_id::text;

  if not exists (
    select 1
    from public.ai_credit_transactions
    where idempotency_key = v_grant_key
  ) then
    update public.ai_credit_accounts
    set balance = balance + v_grant_amount
    where user_id = p_user_id
    returning * into v_account;

    insert into public.ai_credit_transactions (
      user_id,
      transaction_type,
      status,
      action_key,
      amount,
      balance_after,
      reserved_after,
      idempotency_key,
      metadata,
      created_by
    )
    values (
      p_user_id,
      'grant',
      'applied',
      'default_preview_grant',
      v_grant_amount,
      v_account.balance,
      v_account.reserved,
      v_grant_key,
      jsonb_build_object('reason', 'Default preview credits'),
      auth.uid()
    );
  end if;

  return private.ai_credit_usage_payload(p_user_id);
end;
$$;

ALTER FUNCTION "private"."ensure_ai_credit_account"("p_user_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."ensure_ai_credit_account_for_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  perform private.ensure_ai_credit_account(new.id);
  return new;
end;
$$;

ALTER FUNCTION "private"."ensure_ai_credit_account_for_user"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."record_exhausted_song_analysis_dead_letter"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "private"."record_exhausted_song_analysis_dead_letter"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."reserve_assortment_ai_credit"("p_user_id" "uuid", "p_action_key" "text", "p_reference_type" "text", "p_reference_id" "uuid", "p_idempotency_key" "text", "p_metadata" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  account_row public.ai_credit_accounts%rowtype;
  existing_row public.ai_credit_transactions%rowtype;
  usage_row jsonb;
  available_credits integer;
  credit_cost integer;
begin
  select cost.amount into credit_cost
  from public.ai_credit_costs cost
  where cost.key = p_action_key;
  if not found or credit_cost <= 0 then
    raise exception 'Unknown or invalid AI credit action.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));
  select * into existing_row
  from public.ai_credit_transactions transaction_row
  where transaction_row.idempotency_key = p_idempotency_key;
  if found then
    if existing_row.user_id <> p_user_id
      or existing_row.action_key <> p_action_key
      or existing_row.reference_type <> p_reference_type
      or existing_row.reference_id <> p_reference_id
      or existing_row.transaction_type <> 'reserve'
    then
      raise exception 'AI credit idempotency key is already in use.' using errcode = '23505';
    end if;
    return;
  end if;

  perform private.ensure_ai_credit_account(p_user_id);
  select * into account_row
  from public.ai_credit_accounts account
  where account.user_id = p_user_id
  for update;
  if not found then
    raise exception 'Retailer AI credit account was not found.' using errcode = 'P0002';
  end if;

  usage_row := private.ai_credit_usage_payload(p_user_id);
  available_credits := coalesce((usage_row ->> 'available')::integer, 0);
  if credit_cost > available_credits then
    raise exception 'The retailer does not have enough AI credits.' using errcode = 'P0001';
  end if;

  update public.ai_credit_accounts
  set reserved = reserved + credit_cost
  where user_id = p_user_id
  returning * into account_row;

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
    metadata,
    created_by
  ) values (
    p_user_id,
    'reserve',
    'reserved',
    p_action_key,
    credit_cost,
    account_row.balance,
    account_row.reserved,
    p_reference_type,
    p_reference_id,
    p_idempotency_key,
    coalesce(p_metadata, '{}'::jsonb),
    null
  );
end;
$$;

ALTER FUNCTION "private"."reserve_assortment_ai_credit"("p_user_id" "uuid", "p_action_key" "text", "p_reference_type" "text", "p_reference_id" "uuid", "p_idempotency_key" "text", "p_metadata" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."resolve_known_ai_credit"("p_user_id" "uuid", "p_reservation_key" "text", "p_reference_type" "text", "p_reference_id" "uuid", "p_outcome" "text", "p_reason" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "private"."resolve_known_ai_credit"("p_user_id" "uuid", "p_reservation_key" "text", "p_reference_type" "text", "p_reference_id" "uuid", "p_outcome" "text", "p_reason" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."resolve_song_analysis_credit"("p_analysis_id" "uuid", "p_outcome" "text", "p_reason" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "private"."resolve_song_analysis_credit"("p_analysis_id" "uuid", "p_outcome" "text", "p_reason" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."upsert_backend_dead_letter"("p_work_type" "text", "p_work_key" "text", "p_user_id" "uuid", "p_severity" "text", "p_reason" "text", "p_attempt_count" integer, "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "private"."upsert_backend_dead_letter"("p_work_type" "text", "p_work_key" "text", "p_user_id" "uuid", "p_severity" "text", "p_reason" "text", "p_attempt_count" integer, "p_metadata" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."add_refinement_cue_and_settle_credits"("p_refinement_id" "uuid", "p_show_id" "uuid", "p_position" integer, "p_time_seconds" numeric, "p_catalogue_item_id" "uuid", "p_launch_position_index" integer, "p_emphasis" "text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  actor_id uuid := (select auth.uid());
  reservation_key text;
  reservation_status text;
  cue_description text;
  cue_time_seconds numeric(8, 2);
  existing_cue public.show_timeline_items%rowtype;
  next_position integer;
  settlement jsonb;
begin
  if actor_id is null
    or not coalesce(public.current_user_is_active(), false)
  then
    raise exception using
      errcode = '42501',
      message = 'Not permitted.';
  end if;

  if p_refinement_id is null
    or p_show_id is null
    or p_catalogue_item_id is null
    or p_position is null
    or p_position <= 0
    or p_time_seconds is null
    or p_time_seconds < 0
    or p_time_seconds > 3600
    or p_launch_position_index is null
    or p_launch_position_index not between 0 and 2
    or p_emphasis is null
    or p_emphasis not in ('normal', 'accent', 'peak')
    or p_metadata is null
    or jsonb_typeof(p_metadata) <> 'object'
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid refinement cue.';
  end if;

  perform 1
  from public.shows show_row
  where show_row.id = p_show_id
    and show_row.user_id = actor_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Show was not found.';
  end if;

  -- Keep p_position in the public signature for existing callers, but allocate
  -- from the locked schedule so concurrent valid additions cannot collide.
  select coalesce(max(timeline_item.position), 0) + 1
  into next_position
  from public.show_timeline_items timeline_item
  where timeline_item.show_id = p_show_id;

  select catalogue.name
  into cue_description
  from public.catalogue_items catalogue
  where catalogue.id = p_catalogue_item_id;

  if not found or nullif(btrim(cue_description), '') is null then
    raise exception using
      errcode = 'P0002',
      message = 'Firework was not found.';
  end if;

  reservation_key := 'show-refinement:' || p_refinement_id::text || ':reserve';
  perform pg_advisory_xact_lock(hashtextextended(reservation_key, 0));

  select credit_transaction.status
  into reservation_status
  from public.ai_credit_transactions credit_transaction
  where credit_transaction.user_id = actor_id
    and credit_transaction.idempotency_key = reservation_key
    and credit_transaction.transaction_type = 'reserve'
    and credit_transaction.action_key = 'show_refinement'
    and credit_transaction.reference_type = 'show_refinements'
    and credit_transaction.reference_id = p_refinement_id;

  if not found or reservation_status not in ('reserved', 'settled') then
    raise exception using
      errcode = 'P0002',
      message = 'AI credit reservation was not found.';
  end if;

  cue_time_seconds := round(p_time_seconds, 2);
  select *
  into existing_cue
  from public.show_timeline_items timeline_item
  where timeline_item.id = p_refinement_id;

  if found then
    if existing_cue.show_id <> p_show_id
      or existing_cue.catalogue_item_id <> p_catalogue_item_id
      or existing_cue.time_seconds <> cue_time_seconds
      or existing_cue.launch_position_index <> p_launch_position_index
      or existing_cue.emphasis <> p_emphasis
    then
      raise exception using
        errcode = '23505',
        message = 'This refinement identifier is already in use.';
    end if;
  else
    insert into public.show_timeline_items (
      id,
      show_id,
      position,
      time_seconds,
      description,
      catalogue_item_id,
      launch_position_index,
      emphasis
    )
    values (
      p_refinement_id,
      p_show_id,
      next_position,
      cue_time_seconds,
      btrim(cue_description),
      p_catalogue_item_id,
      p_launch_position_index,
      p_emphasis
    );
  end if;

  settlement := public.settle_ai_credit_reservation(
    actor_id,
    reservation_key,
    reservation_key || ':debit',
    p_metadata
  );

  if not coalesce((settlement ->> 'ok')::boolean, false) then
    raise exception using
      errcode = 'P0001',
      message = 'AI credit reservation could not be settled.';
  end if;

  return p_refinement_id;
end;
$$;

ALTER FUNCTION "public"."add_refinement_cue_and_settle_credits"("p_refinement_id" "uuid", "p_show_id" "uuid", "p_position" integer, "p_time_seconds" numeric, "p_catalogue_item_id" "uuid", "p_launch_position_index" integer, "p_emphasis" "text", "p_metadata" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."ai_credit_usage_payload"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if auth.uid() is null
    or (
      auth.uid() <> p_user_id
      and not public.current_user_has_permission('admin.manage_billing')
    ) then
    return jsonb_build_object('ok', false, 'error', 'Not permitted.');
  end if;

  return private.ai_credit_usage_payload(p_user_id);
end;
$$;

ALTER FUNCTION "public"."ai_credit_usage_payload"("p_user_id" "uuid") OWNER TO "postgres";

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

ALTER FUNCTION "public"."claim_cue_generation_attempt"("p_show_id" "uuid", "p_lease_seconds" integer, "p_max_attempts" integer) OWNER TO "postgres";

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

ALTER FUNCTION "public"."claim_song_analysis_attempt"("p_analysis_id" "uuid", "p_lease_seconds" integer, "p_max_attempts" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."complete_cue_generation_attempt"("p_show_id" "uuid", "p_lease_token" "uuid", "p_cue_count" integer, "p_runtime_ms" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "public"."complete_cue_generation_attempt"("p_show_id" "uuid", "p_lease_token" "uuid", "p_cue_count" integer, "p_runtime_ms" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."complete_song_analysis_attempt"("p_analysis_id" "uuid", "p_lease_token" "uuid", "p_analysis_json" "jsonb", "p_markdown" "text", "p_schema_version" "text", "p_runner_version" "text", "p_runtime_ms" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "public"."complete_song_analysis_attempt"("p_analysis_id" "uuid", "p_lease_token" "uuid", "p_analysis_json" "jsonb", "p_markdown" "text", "p_schema_version" "text", "p_runner_version" "text", "p_runtime_ms" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."discard_unused_song_analysis"("p_analysis_id" "uuid", "p_audio_path" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_analysis public.song_analyses%rowtype;
  v_reservation_status text;
  v_credit_result jsonb;
  v_refunded boolean := false;
  v_settled boolean := false;
begin
  if v_user_id is null
    or not coalesce(public.current_user_is_active(), false)
  then
    return jsonb_build_object('ok', false, 'code', 'not_permitted');
  end if;

  if p_analysis_id is null
    or coalesce(trim(p_audio_path), '') = ''
    or p_audio_path not like v_user_id::text || '/%'
    or position('..' in p_audio_path) > 0 then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;

  select * into v_analysis
  from public.song_analyses
  where id = p_analysis_id
    and user_id = v_user_id
  for update;

  if not found then
    -- The database half of an earlier request may already have succeeded while
    -- its Storage API call failed. Returning the caller-owned path lets the API
    -- retry that final deletion without applying another ledger transaction.
    return jsonb_build_object(
      'ok', true,
      'alreadyDeleted', true,
      'audioPath', p_audio_path,
      'refunded', false,
      'settled', false
    );
  end if;

  if v_analysis.audio_path <> p_audio_path then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;

  if exists (
    select 1
    from public.shows
    where music_analysis_id = v_analysis.id
  ) then
    return jsonb_build_object('ok', false, 'code', 'in_use');
  end if;

  select status into v_reservation_status
  from public.ai_credit_transactions
  where user_id = v_user_id
    and idempotency_key = 'music-analysis:' || v_analysis.id::text || ':reserve'
    and transaction_type = 'reserve';

  if v_reservation_status = 'reserved' then
    if v_analysis.status = 'completed' then
      -- Completed analyser work is chargeable even if cleanup wins the small
      -- race before the background callback settles its reservation.
      v_credit_result := public.settle_ai_credit_reservation(
        v_user_id,
        'music-analysis:' || v_analysis.id::text || ':reserve',
        'music-analysis:' || v_analysis.id::text || ':reserve:debit',
        jsonb_build_object('reason', 'Discarded after analysis completed')
      );
      v_settled := coalesce((v_credit_result->>'ok')::boolean, false);
      if not v_settled then
        return jsonb_build_object('ok', false, 'code', 'credit_race');
      end if;
    else
      v_credit_result := public.refund_ai_credit_reservation(
        v_user_id,
        'music-analysis:' || v_analysis.id::text || ':reserve',
        'music-analysis:' || v_analysis.id::text || ':reserve:refund',
        jsonb_build_object('reason', 'Unused music analysis discarded')
      );
      v_refunded := coalesce((v_credit_result->>'ok')::boolean, false);
      if not v_refunded then
        return jsonb_build_object('ok', false, 'code', 'credit_race');
      end if;
    end if;
  end if;

  delete from public.song_analyses
  where id = v_analysis.id
    and user_id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'alreadyDeleted', false,
    'audioPath', v_analysis.audio_path,
    'refunded', v_refunded,
    'settled', v_settled
  );
end;
$$;

ALTER FUNCTION "public"."discard_unused_song_analysis"("p_analysis_id" "uuid", "p_audio_path" "text") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."discard_unused_song_analysis"("p_analysis_id" "uuid", "p_audio_path" "text") IS 'Deletes an owned, unreferenced song analysis and resolves its active credit reservation atomically.';

CREATE OR REPLACE FUNCTION "public"."ensure_ai_credit_account"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if auth.uid() is null
    or not coalesce(public.current_user_is_active(), false)
    or (
      auth.uid() <> p_user_id
      and not public.current_user_has_permission('admin.manage_billing')
    ) then
    return jsonb_build_object('ok', false, 'error', 'Not permitted.');
  end if;

  return private.ensure_ai_credit_account(p_user_id);
end;
$$;

ALTER FUNCTION "public"."ensure_ai_credit_account"("p_user_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."expire_exhausted_cue_generations"("p_limit" integer DEFAULT 10, "p_max_attempts" integer DEFAULT 3) RETURNS TABLE("show_id" "uuid", "user_id" "uuid", "error_message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "public"."expire_exhausted_cue_generations"("p_limit" integer, "p_max_attempts" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."expire_exhausted_song_analyses"("p_limit" integer DEFAULT 10, "p_max_attempts" integer DEFAULT 3) RETURNS TABLE("analysis_id" "uuid", "user_id" "uuid", "error_message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "public"."expire_exhausted_song_analyses"("p_limit" integer, "p_max_attempts" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."fail_cue_generation_attempt"("p_show_id" "uuid", "p_lease_token" "uuid", "p_error_message" "text", "p_runtime_ms" integer, "p_dead_letter" boolean DEFAULT false) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "public"."fail_cue_generation_attempt"("p_show_id" "uuid", "p_lease_token" "uuid", "p_error_message" "text", "p_runtime_ms" integer, "p_dead_letter" boolean) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."fail_song_analysis_attempt"("p_analysis_id" "uuid", "p_lease_token" "uuid", "p_error_message" "text", "p_runtime_ms" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "public"."fail_song_analysis_attempt"("p_analysis_id" "uuid", "p_lease_token" "uuid", "p_error_message" "text", "p_runtime_ms" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."fail_waiting_show_generation"("p_show_id" "uuid", "p_error_message" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "public"."fail_waiting_show_generation"("p_show_id" "uuid", "p_error_message" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_backend_lifecycle_health"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "public"."get_backend_lifecycle_health"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."grant_ai_credits"("p_user_id" "uuid", "p_amount" integer, "p_note" "text", "p_idempotency_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_account public.ai_credit_accounts%rowtype;
  v_existing public.ai_credit_transactions%rowtype;
  v_tx public.ai_credit_transactions%rowtype;
  v_usage jsonb;
begin
  if not public.current_user_has_permission('admin.manage_billing') then
    return jsonb_build_object('ok', false, 'error', 'Not permitted.');
  end if;

  if p_amount is null or p_amount < 1 or p_amount > 100000 then
    return jsonb_build_object('ok', false, 'error', 'Grant amount must be between 1 and 100000.');
  end if;

  if coalesce(trim(p_idempotency_key), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'Missing idempotency key.');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));

  select * into v_existing
  from public.ai_credit_transactions
  where idempotency_key = p_idempotency_key;

  if found then
    v_usage := public.ai_credit_usage_payload(v_existing.user_id);
    return v_usage || jsonb_build_object(
      'transactionId', v_existing.id,
      'alreadyApplied', true
    );
  end if;

  perform public.ensure_ai_credit_account(p_user_id);

  select * into v_account
  from public.ai_credit_accounts
  where user_id = p_user_id
  for update;

  update public.ai_credit_accounts
  set balance = balance + p_amount
  where user_id = p_user_id
  returning * into v_account;

  insert into public.ai_credit_transactions (
    user_id,
    transaction_type,
    status,
    action_key,
    amount,
    balance_after,
    reserved_after,
    idempotency_key,
    metadata,
    created_by
  )
  values (
    p_user_id,
    'grant',
    'applied',
    'admin_credit_grant',
    p_amount,
    v_account.balance,
    v_account.reserved,
    p_idempotency_key,
    jsonb_build_object('note', nullif(trim(coalesce(p_note, '')), '')),
    auth.uid()
  )
  returning * into v_tx;

  v_usage := public.ai_credit_usage_payload(p_user_id);

  return v_usage || jsonb_build_object('transactionId', v_tx.id);
end;
$$;

ALTER FUNCTION "public"."grant_ai_credits"("p_user_id" "uuid", "p_amount" integer, "p_note" "text", "p_idempotency_key" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."list_orphan_audio_objects"("p_limit" integer DEFAULT 25, "p_grace_hours" integer DEFAULT 24) RETURNS TABLE("audio_path" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
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
$_$;

ALTER FUNCTION "public"."list_orphan_audio_objects"("p_limit" integer, "p_grace_hours" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."prepare_assortment_song_analysis"("p_assortment_token" "text", "p_selection_id" "uuid", "p_analysis_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  link_row public.assortment_public_links;
  assortment_row public.assortments;
  selection_row public.assortment_song_selections;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Not permitted.' using errcode = '42501';
  end if;

  select * into link_row
  from public.assortment_public_links link
  where link.public_token = p_assortment_token
    and link.is_enabled = true
  for share;
  if not found then
    raise exception 'Assortment unavailable.' using errcode = 'P0002';
  end if;

  select * into assortment_row
  from public.assortments assortment
  where assortment.id = link_row.assortment_id
    and assortment.is_active = true
  for share;
  if not found then
    raise exception 'Assortment unavailable.' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.users funding_user
    where funding_user.id = link_row.funding_user_id
      and funding_user.status = 'active'
  ) then
    raise exception 'Assortment unavailable.' using errcode = 'P0002';
  end if;

  select * into selection_row
  from public.assortment_song_selections selection
  where selection.id = p_selection_id
    and selection.assortment_id = assortment_row.id
    and selection.funding_user_id = link_row.funding_user_id
  for update;
  if not found
    or selection_row.expires_at <= now()
    or selection_row.music_analysis_id is not null
  then
    raise exception 'Song selection unavailable.' using errcode = 'P0002';
  end if;

  perform private.reserve_assortment_ai_credit(
    link_row.funding_user_id,
    'music_analysis',
    'song_analyses',
    p_analysis_id,
    'music-analysis:' || p_analysis_id::text || ':reserve',
    jsonb_build_object(
      'assortmentId', assortment_row.id,
      'source', 'assortment_qr',
      'audioPath', selection_row.audio_path,
      'contentType', selection_row.content_type,
      'sizeBytes', selection_row.size_bytes
    )
  );

  insert into public.song_analyses (
    id,
    user_id,
    audio_path,
    original_filename,
    content_type,
    size_bytes,
    personality,
    status,
    runner_version,
    schema_version
  ) values (
    p_analysis_id,
    link_row.funding_user_id,
    selection_row.audio_path,
    selection_row.original_filename,
    selection_row.content_type,
    selection_row.size_bytes,
    'balanced',
    'running',
    'modal-librosa-2',
    '1.4.0'
  );

  update public.assortment_song_selections
  set music_analysis_id = p_analysis_id
  where id = selection_row.id;

  return jsonb_build_object(
    'ok', true,
    'analysisId', p_analysis_id,
    'fundingUserId', link_row.funding_user_id
  );
end;
$$;

ALTER FUNCTION "public"."prepare_assortment_song_analysis"("p_assortment_token" "text", "p_selection_id" "uuid", "p_analysis_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."purge_expired_song_analyses"("p_limit" integer DEFAULT 25, "p_retention_days" integer DEFAULT 7) RETURNS TABLE("analysis_id" "uuid", "user_id" "uuid", "audio_path" "text", "analysis_status" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "public"."purge_expired_song_analyses"("p_limit" integer, "p_retention_days" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."record_backend_dead_letter"("p_work_type" "text", "p_work_key" "text", "p_user_id" "uuid", "p_severity" "text", "p_reason" "text", "p_attempt_count" integer, "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "public"."record_backend_dead_letter"("p_work_type" "text", "p_work_key" "text", "p_user_id" "uuid", "p_severity" "text", "p_reason" "text", "p_attempt_count" integer, "p_metadata" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."refund_ai_credit_reservation"("p_user_id" "uuid", "p_reservation_key" "text", "p_idempotency_key" "text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_account public.ai_credit_accounts%rowtype;
  v_existing public.ai_credit_transactions%rowtype;
  v_reservation public.ai_credit_transactions%rowtype;
  v_tx public.ai_credit_transactions%rowtype;
  v_usage jsonb;
begin
  if auth.uid() is null
    or not coalesce(public.current_user_is_active(), false)
    or (
      auth.uid() <> p_user_id
      and not public.current_user_has_permission('admin.manage_billing')
    )
  then
    return jsonb_build_object('ok', false, 'error', 'Not permitted.');
  end if;

  if coalesce(trim(p_reservation_key), '') = ''
    or coalesce(trim(p_idempotency_key), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'Missing idempotency key.');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));

  select * into v_existing
  from public.ai_credit_transactions
  where idempotency_key = p_idempotency_key;

  if found then
    v_usage := public.ai_credit_usage_payload(v_existing.user_id);
    return v_usage || jsonb_build_object(
      'transactionId', v_existing.id,
      'alreadyApplied', true
    );
  end if;

  select * into v_reservation
  from public.ai_credit_transactions
  where idempotency_key = p_reservation_key
    and user_id = p_user_id
    and transaction_type = 'reserve'
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'AI credit reservation was not found.');
  end if;

  if v_reservation.status = 'refunded' then
    v_usage := public.ai_credit_usage_payload(p_user_id);
    return v_usage || jsonb_build_object('ok', true, 'alreadyApplied', true);
  end if;

  if v_reservation.status <> 'reserved' then
    return jsonb_build_object('ok', false, 'error', 'AI credit reservation is not active.');
  end if;

  select * into v_account
  from public.ai_credit_accounts
  where user_id = p_user_id
  for update;

  update public.ai_credit_accounts
  set reserved = reserved - v_reservation.amount
  where user_id = p_user_id
    and reserved >= v_reservation.amount
  returning * into v_account;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'AI credit reservation could not be refunded.');
  end if;

  update public.ai_credit_transactions
  set status = 'refunded',
      balance_after = v_account.balance,
      reserved_after = v_account.reserved
  where id = v_reservation.id;

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
  )
  values (
    p_user_id,
    'refund',
    'applied',
    v_reservation.action_key,
    v_reservation.amount,
    v_account.balance,
    v_account.reserved,
    v_reservation.reference_type,
    v_reservation.reference_id,
    p_idempotency_key,
    v_reservation.id,
    coalesce(p_metadata, '{}'::jsonb),
    auth.uid()
  )
  returning * into v_tx;

  v_usage := public.ai_credit_usage_payload(p_user_id);

  return v_usage || jsonb_build_object('transactionId', v_tx.id);
end;
$$;

ALTER FUNCTION "public"."refund_ai_credit_reservation"("p_user_id" "uuid", "p_reservation_key" "text", "p_idempotency_key" "text", "p_metadata" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."reserve_ai_credits"("p_user_id" "uuid", "p_action_key" "text", "p_amount" integer, "p_reference_type" "text", "p_reference_id" "uuid", "p_idempotency_key" "text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_account public.ai_credit_accounts%rowtype;
  v_existing public.ai_credit_transactions%rowtype;
  v_tx public.ai_credit_transactions%rowtype;
  v_usage jsonb;
  v_available integer;
  v_amount integer;
begin
  if auth.uid() is null
    or not coalesce(public.current_user_is_active(), false)
    or (
      auth.uid() <> p_user_id
      and not public.current_user_has_permission('admin.manage_billing')
    )
  then
    return jsonb_build_object('ok', false, 'error', 'Not permitted.');
  end if;

  if coalesce(trim(p_idempotency_key), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'Missing idempotency key.');
  end if;

  select amount into v_amount
  from public.ai_credit_costs
  where key = p_action_key;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Unknown AI credit action.');
  end if;

  if v_amount <= 0 then
    return jsonb_build_object('ok', false, 'error', 'Credit amount must be positive.');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));

  select * into v_existing
  from public.ai_credit_transactions
  where idempotency_key = p_idempotency_key;

  if found then
    v_usage := public.ai_credit_usage_payload(v_existing.user_id);
    return v_usage || jsonb_build_object(
      'transactionId', v_existing.id,
      'alreadyApplied', true
    );
  end if;

  perform public.ensure_ai_credit_account(p_user_id);

  select * into v_account
  from public.ai_credit_accounts
  where user_id = p_user_id
  for update;

  v_usage := public.ai_credit_usage_payload(p_user_id);
  v_available := coalesce((v_usage->>'available')::integer, 0);

  if v_amount > v_available then
    return public.ai_credit_usage_payload(p_user_id) || jsonb_build_object(
      'ok', false,
      'error', format(
        'Not enough AI credits or usage limit remaining. This needs %s credits and %s are available.',
        v_amount,
        v_available
      )
    );
  end if;

  update public.ai_credit_accounts
  set reserved = reserved + v_amount
  where user_id = p_user_id
  returning * into v_account;

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
    metadata,
    created_by
  )
  values (
    p_user_id,
    'reserve',
    'reserved',
    p_action_key,
    v_amount,
    v_account.balance,
    v_account.reserved,
    p_reference_type,
    p_reference_id,
    p_idempotency_key,
    coalesce(p_metadata, '{}'::jsonb),
    auth.uid()
  )
  returning * into v_tx;

  v_usage := public.ai_credit_usage_payload(p_user_id);

  return v_usage || jsonb_build_object(
    'transactionId', v_tx.id,
    'alreadyApplied', false
  );
end;
$$;

ALTER FUNCTION "public"."reserve_ai_credits"("p_user_id" "uuid", "p_action_key" "text", "p_amount" integer, "p_reference_type" "text", "p_reference_id" "uuid", "p_idempotency_key" "text", "p_metadata" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."resolve_backend_dead_letter"("p_dead_letter_id" "uuid", "p_status" "text", "p_resolution_note" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "public"."resolve_backend_dead_letter"("p_dead_letter_id" "uuid", "p_status" "text", "p_resolution_note" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."resolve_reconciled_show_generation_credit"("p_show_id" "uuid", "p_outcome" "text", "p_reason" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "public"."resolve_reconciled_show_generation_credit"("p_show_id" "uuid", "p_outcome" "text", "p_reason" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."schedule_cue_generation_retry"("p_show_id" "uuid", "p_lease_token" "uuid", "p_error_message" "text", "p_runtime_ms" integer, "p_retry_delay_seconds" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "public"."schedule_cue_generation_retry"("p_show_id" "uuid", "p_lease_token" "uuid", "p_error_message" "text", "p_runtime_ms" integer, "p_retry_delay_seconds" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."schedule_song_analysis_retry"("p_analysis_id" "uuid", "p_lease_token" "uuid", "p_error_message" "text", "p_runtime_ms" integer, "p_retry_delay_seconds" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "public"."schedule_song_analysis_retry"("p_analysis_id" "uuid", "p_lease_token" "uuid", "p_error_message" "text", "p_runtime_ms" integer, "p_retry_delay_seconds" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."settle_ai_credit_reservation"("p_user_id" "uuid", "p_reservation_key" "text", "p_idempotency_key" "text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_account public.ai_credit_accounts%rowtype;
  v_existing public.ai_credit_transactions%rowtype;
  v_reservation public.ai_credit_transactions%rowtype;
  v_tx public.ai_credit_transactions%rowtype;
  v_usage jsonb;
begin
  if auth.uid() is null
    or not coalesce(public.current_user_is_active(), false)
    or (
      auth.uid() <> p_user_id
      and not public.current_user_has_permission('admin.manage_billing')
    )
  then
    return jsonb_build_object('ok', false, 'error', 'Not permitted.');
  end if;

  if coalesce(trim(p_reservation_key), '') = ''
    or coalesce(trim(p_idempotency_key), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'Missing idempotency key.');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));

  select * into v_existing
  from public.ai_credit_transactions
  where idempotency_key = p_idempotency_key;

  if found then
    v_usage := public.ai_credit_usage_payload(v_existing.user_id);
    return v_usage || jsonb_build_object(
      'transactionId', v_existing.id,
      'alreadyApplied', true
    );
  end if;

  select * into v_reservation
  from public.ai_credit_transactions
  where idempotency_key = p_reservation_key
    and user_id = p_user_id
    and transaction_type = 'reserve'
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'AI credit reservation was not found.');
  end if;

  if v_reservation.status = 'settled' then
    v_usage := public.ai_credit_usage_payload(p_user_id);
    return v_usage || jsonb_build_object('ok', true, 'alreadyApplied', true);
  end if;

  if v_reservation.status <> 'reserved' then
    return jsonb_build_object('ok', false, 'error', 'AI credit reservation is not active.');
  end if;

  select * into v_account
  from public.ai_credit_accounts
  where user_id = p_user_id
  for update;

  update public.ai_credit_accounts
  set reserved = reserved - v_reservation.amount,
      balance = balance - v_reservation.amount
  where user_id = p_user_id
    and reserved >= v_reservation.amount
    and balance >= v_reservation.amount
  returning * into v_account;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'AI credit reservation could not be settled.');
  end if;

  update public.ai_credit_transactions
  set status = 'settled',
      balance_after = v_account.balance,
      reserved_after = v_account.reserved
  where id = v_reservation.id;

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
  )
  values (
    p_user_id,
    'debit',
    'applied',
    v_reservation.action_key,
    v_reservation.amount,
    v_account.balance,
    v_account.reserved,
    v_reservation.reference_type,
    v_reservation.reference_id,
    p_idempotency_key,
    v_reservation.id,
    coalesce(p_metadata, '{}'::jsonb),
    auth.uid()
  )
  returning * into v_tx;

  v_usage := public.ai_credit_usage_payload(p_user_id);

  return v_usage || jsonb_build_object('transactionId', v_tx.id);
end;
$$;

ALTER FUNCTION "public"."settle_ai_credit_reservation"("p_user_id" "uuid", "p_reservation_key" "text", "p_idempotency_key" "text", "p_metadata" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_prompt_config_atomically"("p_key" "text", "p_system_prompt_text" "text" DEFAULT NULL::"text", "p_product_context_text" "text" DEFAULT NULL::"text", "p_product_catalogue_fields" "jsonb" DEFAULT NULL::"jsonb") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_caller_id uuid := auth.uid();
begin
  if v_caller_id is null
    or not coalesce(public.current_user_is_active(), false)
    or not coalesce(public.current_user_has_permission('admin.manage_prompts'), false) then
    raise exception using
      errcode = '42501',
      message = 'Not permitted.';
  end if;

  if p_key is null
    or p_key not in ('show_cue_generation', 'firework_video_reconstruction')
    or (
      p_system_prompt_text is null
      and p_product_context_text is null
      and p_product_catalogue_fields is null
    )
    or (
      p_system_prompt_text is not null
      and (
        length(trim(p_system_prompt_text)) < 40
        or length(p_system_prompt_text) > 60000
      )
    )
    or (
      p_product_context_text is not null
      and (
        p_key <> 'show_cue_generation'
        or length(p_product_context_text) > 20000
      )
    ) then
    raise exception using
      errcode = '22023',
      message = 'Invalid prompt configuration request.';
  end if;

  if p_product_catalogue_fields is not null then
    if p_key <> 'show_cue_generation'
      or jsonb_typeof(p_product_catalogue_fields) is distinct from 'array' then
      raise exception using
        errcode = '22023',
        message = 'Invalid product catalogue fields.';
    end if;

    if jsonb_array_length(p_product_catalogue_fields) = 0
      or not p_product_catalogue_fields @> '["id"]'::jsonb
      or exists (
        select 1
        from jsonb_array_elements_text(p_product_catalogue_fields) as field(value)
        where field.value not in (
          'id',
          'name',
          'description',
          'durationSeconds',
          'shotCount',
          'isMultiShot',
          'heightMeters',
          'caliber',
          'shellType',
          'color',
          'colorPalette',
          'effects'
        )
      )
      or jsonb_array_length(p_product_catalogue_fields) <> (
        select count(distinct field.value)
        from jsonb_array_elements_text(p_product_catalogue_fields) as field(value)
      ) then
      raise exception using
        errcode = '22023',
        message = 'Invalid product catalogue fields.';
    end if;
  end if;

  update public.prompt_configs
  set
    system_prompt_text = coalesce(p_system_prompt_text, system_prompt_text),
    product_context_text = case
      when p_product_context_text is null then product_context_text
      else p_product_context_text
    end,
    updated_by = v_caller_id
  where key = p_key;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Prompt configuration was not found.';
  end if;

  if p_product_catalogue_fields is not null then
    update public.generation_settings
    set
      product_catalogue_fields = p_product_catalogue_fields,
      updated_by = v_caller_id
    where key = 'show_cue_generation';

    if not found then
      raise exception using
        errcode = 'P0002',
        message = 'Show generation settings were not found.';
    end if;
  end if;

  return true;
end;
$$;

ALTER FUNCTION "public"."update_prompt_config_atomically"("p_key" "text", "p_system_prompt_text" "text", "p_product_context_text" "text", "p_product_catalogue_fields" "jsonb") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."update_prompt_config_atomically"("p_key" "text", "p_system_prompt_text" "text", "p_product_context_text" "text", "p_product_catalogue_fields" "jsonb") IS 'Atomically updates one admin prompt and its optional show-generation catalogue fields.';

CREATE OR REPLACE FUNCTION "public"."update_show_generation_mode"("p_generation_mode" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_caller_id uuid := auth.uid();
begin
  if v_caller_id is null
    or not coalesce(public.current_user_is_active(), false)
    or not coalesce(public.current_user_has_permission('admin.manage_prompts'), false) then
    raise exception using
      errcode = '42501',
      message = 'Not permitted.';
  end if;

  if p_generation_mode is null or p_generation_mode not in ('fast', 'llm') then
    raise exception using
      errcode = '22023',
      message = 'Invalid generation mode.';
  end if;

  update public.generation_settings
  set
    generation_mode = p_generation_mode,
    updated_by = v_caller_id
  where key = 'show_cue_generation';

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Show generation settings were not found.';
  end if;

  return true;
end;
$$;

ALTER FUNCTION "public"."update_show_generation_mode"("p_generation_mode" "text") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."update_show_generation_mode"("p_generation_mode" "text") IS 'Updates the show-generation planner mode for an active prompt administrator.';
