-- ShowCrafter baseline: shows.
set check_function_bodies = false;

CREATE OR REPLACE FUNCTION "private"."assert_all_published_show_presets"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  preset public.show_presets%rowtype;
begin
  for preset in
    select *
    from public.show_presets
    where is_published
    order by id
  loop
    perform private.assert_show_preset_publishable(
      preset.id,
      preset.is_published,
      preset.published_at,
      preset.duration_seconds,
      preset.preview_cues
    );
  end loop;
end;
$$;

ALTER FUNCTION "private"."assert_all_published_show_presets"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."assert_published_presets_for_catalogue_item"("p_catalogue_item_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  preset public.show_presets%rowtype;
begin
  for preset in
    select show_preset.*
    from public.show_presets show_preset
    where show_preset.is_published
      and private.show_preset_cue_catalogue_item_ids(show_preset.preview_cues)
            @> array[p_catalogue_item_id::text]
    order by show_preset.id
  loop
    perform private.assert_show_preset_publishable(
      preset.id,
      preset.is_published,
      preset.published_at,
      preset.duration_seconds,
      preset.preview_cues
    );
  end loop;
end;
$$;

ALTER FUNCTION "private"."assert_published_presets_for_catalogue_item"("p_catalogue_item_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."assert_show_preset_publishable"("p_preset_id" "uuid", "p_is_published" boolean, "p_published_at" timestamp with time zone, "p_duration_seconds" integer, "p_preview_cues" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  cue_row record;
  catalogue_item_id_text text;
  cue_time numeric;
  launch_position integer;
  product_duration numeric;
  resolved_catalogue_slug text;
  occupied_launch_positions integer[];
  occupied_launch_position integer;
  busy_until numeric[] := array[0::numeric, 0::numeric, 0::numeric];
begin
  if not p_is_published then
    return;
  end if;

  if p_duration_seconds is null or p_duration_seconds <= 0 then
    raise exception 'Published show preset % requires a positive duration.', p_preset_id
      using errcode = 'check_violation';
  end if;

  if p_published_at is null then
    raise exception 'Published show preset % requires published_at.', p_preset_id
      using errcode = 'check_violation';
  end if;

  if jsonb_typeof(p_preview_cues) is distinct from 'array' then
    raise exception 'Published show preset % requires a non-empty cue array.', p_preset_id
      using errcode = 'check_violation';
  end if;

  if jsonb_array_length(p_preview_cues) = 0 then
    raise exception 'Published show preset % requires a non-empty cue array.', p_preset_id
      using errcode = 'check_violation';
  end if;

  -- Validate every value before the ordered pass performs numeric and UUID
  -- casts. UUIDs emitted by the app use PostgreSQL's canonical text form.
  for cue_row in
    select cue, cue_index
    from jsonb_array_elements(p_preview_cues)
      with ordinality as item(cue, cue_index)
  loop
    if jsonb_typeof(cue_row.cue) is distinct from 'object' then
      raise exception 'Published show preset % cue % must be an object.',
        p_preset_id, cue_row.cue_index
        using errcode = 'check_violation';
    end if;

    catalogue_item_id_text := cue_row.cue->>'catalogueItemId';
    if catalogue_item_id_text is null
      or catalogue_item_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'Published show preset % cue % has an invalid catalogue item ID.',
        p_preset_id, cue_row.cue_index
        using errcode = 'check_violation';
    end if;

    if jsonb_typeof(cue_row.cue->'catalogueItemSlug') is distinct from 'string' then
      raise exception 'Published show preset % cue % has an invalid catalogue item slug.',
        p_preset_id, cue_row.cue_index
        using errcode = 'check_violation';
    end if;

    if char_length(btrim(cue_row.cue->>'catalogueItemSlug')) not between 1 and 120 then
      raise exception 'Published show preset % cue % has an invalid catalogue item slug.',
        p_preset_id, cue_row.cue_index
        using errcode = 'check_violation';
    end if;

    if jsonb_typeof(cue_row.cue->'description') is distinct from 'string' then
      raise exception 'Published show preset % cue % has an invalid description.',
        p_preset_id, cue_row.cue_index
        using errcode = 'check_violation';
    end if;

    if char_length(btrim(cue_row.cue->>'description')) not between 1 and 180 then
      raise exception 'Published show preset % cue % has an invalid description.',
        p_preset_id, cue_row.cue_index
        using errcode = 'check_violation';
    end if;

    if jsonb_typeof(cue_row.cue->'emphasis') is distinct from 'string'
      or cue_row.cue->>'emphasis' not in ('normal', 'accent', 'peak') then
      raise exception 'Published show preset % cue % has an invalid emphasis.',
        p_preset_id, cue_row.cue_index
        using errcode = 'check_violation';
    end if;

    if jsonb_typeof(cue_row.cue->'timeSeconds') is distinct from 'number' then
      raise exception 'Published show preset % cue % has an invalid start time.',
        p_preset_id, cue_row.cue_index
        using errcode = 'check_violation';
    end if;

    if (cue_row.cue->>'timeSeconds')::numeric < 0 then
      raise exception 'Published show preset % cue % has an invalid start time.',
        p_preset_id, cue_row.cue_index
        using errcode = 'check_violation';
    end if;

    if jsonb_typeof(cue_row.cue->'launchPositionIndex') is distinct from 'number' then
      raise exception 'Published show preset % cue % has an invalid launch position.',
        p_preset_id, cue_row.cue_index
        using errcode = 'check_violation';
    end if;

    if (cue_row.cue->>'launchPositionIndex')::numeric
        <> trunc((cue_row.cue->>'launchPositionIndex')::numeric)
      or (cue_row.cue->>'launchPositionIndex')::numeric not between 0 and 2 then
      raise exception 'Published show preset % cue % has an invalid launch position.',
        p_preset_id, cue_row.cue_index
        using errcode = 'check_violation';
    end if;

    select
      item.part_number,
      private.catalogue_item_safe_duration(item.id)
    into resolved_catalogue_slug, product_duration
    from public.catalogue_items item
    where item.id = catalogue_item_id_text::uuid;
    if not found or product_duration is null then
      raise exception 'Published show preset % cue % references a missing catalogue item.',
        p_preset_id, cue_row.cue_index
        using errcode = 'foreign_key_violation';
    end if;

    if cue_row.cue->>'catalogueItemSlug' <> resolved_catalogue_slug then
      raise exception 'Published show preset % cue % has a stale catalogue item slug.',
        p_preset_id, cue_row.cue_index
        using errcode = 'foreign_key_violation';
    end if;

    cue_time := (cue_row.cue->>'timeSeconds')::numeric;
    if cue_time + product_duration > p_duration_seconds then
      raise exception 'Published show preset % cue % ends after the show duration.',
        p_preset_id, cue_row.cue_index
        using errcode = 'check_violation';
    end if;
  end loop;

  -- Sort independently of JSON array order. Validate every occupied position
  -- before reserving any of them so one cue is applied atomically to the local
  -- schedule model.
  for cue_row in
    select cue, cue_index
    from jsonb_array_elements(p_preview_cues)
      with ordinality as item(cue, cue_index)
    order by (cue->>'timeSeconds')::numeric, cue_index
  loop
    cue_time := (cue_row.cue->>'timeSeconds')::numeric;
    launch_position := (cue_row.cue->>'launchPositionIndex')::integer;
    product_duration := private.catalogue_item_safe_duration(
      (cue_row.cue->>'catalogueItemId')::uuid
    );
    occupied_launch_positions := private.catalogue_item_occupied_launch_positions(
      (cue_row.cue->>'catalogueItemId')::uuid,
      launch_position
    );

    foreach occupied_launch_position in array occupied_launch_positions loop
      if busy_until[occupied_launch_position + 1] > cue_time then
        raise exception 'Published show preset % cue % overlaps occupied launch position %.',
          p_preset_id, cue_row.cue_index, occupied_launch_position
          using errcode = 'check_violation';
      end if;
    end loop;

    foreach occupied_launch_position in array occupied_launch_positions loop
      busy_until[occupied_launch_position + 1] := cue_time + product_duration;
    end loop;
  end loop;
end;
$_$;

ALTER FUNCTION "private"."assert_show_preset_publishable"("p_preset_id" "uuid", "p_is_published" boolean, "p_published_at" timestamp with time zone, "p_duration_seconds" integer, "p_preview_cues" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."assert_show_timeline_after_source_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  perform private.assert_show_timeline_non_overlapping();
  return null;
end;
$$;

ALTER FUNCTION "private"."assert_show_timeline_after_source_mutation"() OWNER TO "postgres";

COMMENT ON FUNCTION "private"."assert_show_timeline_after_source_mutation"() IS 'Unused by any trigger; kept only so a full unscoped re-check remains callable for manual audits.';

CREATE OR REPLACE FUNCTION "private"."assert_show_timeline_for_catalogue_item"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  target_id uuid;
  affected_show_ids uuid[];
begin
  if tg_op = 'DELETE' then
    target_id := old.id;
  else
    target_id := new.id;
  end if;

  select coalesce(array_agg(distinct timeline_item.show_id), array[]::uuid[])
  into affected_show_ids
  from public.show_timeline_items timeline_item
  where timeline_item.catalogue_item_id = target_id;

  perform private.assert_show_timeline_non_overlapping(affected_show_ids);
  return null;
end;
$$;

ALTER FUNCTION "private"."assert_show_timeline_for_catalogue_item"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."assert_show_timeline_for_firework"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  target_id uuid;
  affected_catalogue_item_ids uuid[];
  affected_show_ids uuid[];
begin
  if tg_op = 'DELETE' then
    target_id := old.id;
  else
    target_id := new.id;
  end if;

  select coalesce(array_agg(distinct item.id), array[]::uuid[])
  into affected_catalogue_item_ids
  from public.catalogue_items item
  where item.firework_id = target_id
     or item.multishot_id in (
       select shot.multishot_id
       from public.multishot_fireworks shot
       where shot.firework_id = target_id
     );

  select coalesce(array_agg(distinct timeline_item.show_id), array[]::uuid[])
  into affected_show_ids
  from public.show_timeline_items timeline_item
  where timeline_item.catalogue_item_id = any(affected_catalogue_item_ids);

  perform private.assert_show_timeline_non_overlapping(affected_show_ids);
  return null;
end;
$$;

ALTER FUNCTION "private"."assert_show_timeline_for_firework"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."assert_show_timeline_for_multishot_shot"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  target_multishot_ids uuid[];
  affected_catalogue_item_ids uuid[];
  affected_show_ids uuid[];
begin
  if tg_op = 'DELETE' then
    target_multishot_ids := array[old.multishot_id];
  elsif tg_op = 'INSERT' then
    target_multishot_ids := array[new.multishot_id];
  else
    target_multishot_ids := array[new.multishot_id, old.multishot_id];
  end if;

  select coalesce(array_agg(distinct item.id), array[]::uuid[])
  into affected_catalogue_item_ids
  from public.catalogue_items item
  where item.multishot_id = any(target_multishot_ids);

  select coalesce(array_agg(distinct timeline_item.show_id), array[]::uuid[])
  into affected_show_ids
  from public.show_timeline_items timeline_item
  where timeline_item.catalogue_item_id = any(affected_catalogue_item_ids);

  perform private.assert_show_timeline_non_overlapping(affected_show_ids);
  return null;
end;
$$;

ALTER FUNCTION "private"."assert_show_timeline_for_multishot_shot"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."assert_show_timeline_non_overlapping"("p_show_ids" "uuid"[] DEFAULT NULL::"uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  conflict record;
begin
  -- Preserve the deployed scoped-preflight contract. An explicit empty set
  -- means the caller has proved that no current show needs revalidation.
  if p_show_ids is not null and coalesce(array_length(p_show_ids, 1), 0) = 0 then
    return;
  end if;

  select
    first_item.show_id,
    first_item.id as first_cue_id,
    second_item.id as second_cue_id,
    first_occupancy.positions as first_positions,
    second_occupancy.positions as second_positions
  into conflict
  from public.show_timeline_items first_item
  join public.show_timeline_items second_item
    on second_item.show_id = first_item.show_id
   and second_item.position > first_item.position
  cross join lateral (
    select private.catalogue_item_occupied_launch_positions(
      first_item.catalogue_item_id,
      first_item.launch_position_index
    ) as positions
  ) first_occupancy
  cross join lateral (
    select private.catalogue_item_occupied_launch_positions(
      second_item.catalogue_item_id,
      second_item.launch_position_index
    ) as positions
  ) second_occupancy
  where (p_show_ids is null or first_item.show_id = any(p_show_ids))
    and first_occupancy.positions && second_occupancy.positions
    and first_item.time_seconds
          < second_item.time_seconds + private.show_launch_interval_seconds()
    and second_item.time_seconds
          < first_item.time_seconds + private.show_launch_interval_seconds()
  limit 1;

  if found then
    raise exception
      'Show % has ignitions closer than 0.5 seconds for cues % and % on launch positions % and %.',
      conflict.show_id,
      conflict.first_cue_id,
      conflict.second_cue_id,
      conflict.first_positions,
      conflict.second_positions
      using errcode = '23514';
  end if;
end;
$$;

ALTER FUNCTION "private"."assert_show_timeline_non_overlapping"("p_show_ids" "uuid"[]) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."create_assortment_public_link"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  funding_user_id uuid := coalesce(new.created_by, auth.uid());
begin
  if funding_user_id is not null then
    insert into public.assortment_public_links (assortment_id, funding_user_id)
    values (new.id, funding_user_id);
  end if;
  return new;
end;
$$;

ALTER FUNCTION "private"."create_assortment_public_link"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."lock_show_timeline_sources_exclusive"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('show-timeline-source-safety', 0)
  );
  return null;
end;
$$;

ALTER FUNCTION "private"."lock_show_timeline_sources_exclusive"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."lock_show_timeline_sources_shared"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  perform pg_catalog.pg_advisory_xact_lock_shared(
    pg_catalog.hashtextextended('show-timeline-source-safety', 0)
  );
  return null;
end;
$$;

ALTER FUNCTION "private"."lock_show_timeline_sources_shared"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."reject_overlapping_show_timeline_item"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  candidate_occupied_positions integer[];
begin
  -- Serialise every supported mutation path on the owned show before reading
  -- its current schedule. Public mutation RPCs take the same row lock.
  perform 1
  from public.shows show_row
  where show_row.id = new.show_id
  for update;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Show was not found.';
  end if;

  perform 1
  from public.catalogue_items item
  where item.id = new.catalogue_item_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Catalogue item was not found.';
  end if;

  candidate_occupied_positions :=
    private.catalogue_item_occupied_launch_positions(
      new.catalogue_item_id,
      new.launch_position_index
    );

  if exists (
    select 1
    from public.show_timeline_items existing_item
    where existing_item.show_id = new.show_id
      and existing_item.id <> new.id
      and private.catalogue_item_occupied_launch_positions(
            existing_item.catalogue_item_id,
            existing_item.launch_position_index
          ) && candidate_occupied_positions
      and new.time_seconds
            < existing_item.time_seconds + private.show_launch_interval_seconds()
      and existing_item.time_seconds
            < new.time_seconds + private.show_launch_interval_seconds()
  ) then
    raise exception using
      errcode = '23514',
      message = 'Timeline item is too close to another ignition on this launch position.';
  end if;

  return new;
end;
$$;

ALTER FUNCTION "private"."reject_overlapping_show_timeline_item"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."show_launch_interval_seconds"() RETURNS numeric
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  select 0.5::numeric;
$$;

ALTER FUNCTION "private"."show_launch_interval_seconds"() OWNER TO "postgres";

COMMENT ON FUNCTION "private"."show_launch_interval_seconds"() IS 'Minimum separation between independently wired ignitions at an occupied launch position. Visual duration is intentionally separate.';

CREATE OR REPLACE FUNCTION "private"."show_preset_cue_catalogue_item_ids"("cues" "jsonb") RETURNS "text"[]
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  select coalesce(array_agg(cue ->> 'catalogueItemId'), array[]::text[])
  from jsonb_array_elements(cues) as cue;
$$;

ALTER FUNCTION "private"."show_preset_cue_catalogue_item_ids"("cues" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."validate_show_preset_publication"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  perform private.assert_show_preset_publishable(
    new.id,
    new.is_published,
    new.published_at,
    new.duration_seconds,
    new.preview_cues
  );
  return new;
end;
$$;

ALTER FUNCTION "private"."validate_show_preset_publication"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."add_show_timeline_item"("p_show_id" "uuid", "p_time_seconds" numeric, "p_catalogue_item_id" "uuid", "p_launch_position_index" integer, "p_emphasis" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  actor_id uuid := (select auth.uid());
  cue_id uuid;
  cue_description text;
  next_position integer;
begin
  if actor_id is null
    or not coalesce(public.current_user_is_active(), false)
  then
    raise exception using
      errcode = '42501',
      message = 'Not permitted.';
  end if;

  if p_show_id is null
    or p_time_seconds is null
    or p_time_seconds < 0
    or p_time_seconds > 3600
    or p_catalogue_item_id is null
    or p_launch_position_index is null
    or p_launch_position_index not between 0 and 2
    or p_emphasis is null
    or p_emphasis not in ('normal', 'accent', 'peak')
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid timeline item.';
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

  insert into public.show_timeline_items (
    show_id,
    position,
    time_seconds,
    description,
    catalogue_item_id,
    launch_position_index,
    emphasis
  )
  values (
    p_show_id,
    next_position,
    round(p_time_seconds, 2),
    btrim(cue_description),
    p_catalogue_item_id,
    p_launch_position_index,
    p_emphasis
  )
  returning id into cue_id;

  return cue_id;
end;
$$;

ALTER FUNCTION "public"."add_show_timeline_item"("p_show_id" "uuid", "p_time_seconds" numeric, "p_catalogue_item_id" "uuid", "p_launch_position_index" integer, "p_emphasis" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_assortment_qr_show"("p_assortment_token" "text", "p_selection_id" "uuid", "p_public_access_token_hash" "text", "p_title" "text", "p_generation_mode" "text", "p_selected_cue_model" "text", "p_credit_action_key" "text", "p_cover_shader" "jsonb", "p_source_show_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  link_row public.assortment_public_links;
  assortment_row public.assortments;
  selection_row public.assortment_song_selections;
  source_show_row public.shows;
  new_show_id uuid := gen_random_uuid();
  show_slug text := 'assortment-show-' || left(replace(gen_random_uuid()::text, '-', ''), 12);
  item_count integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Not permitted.' using errcode = '42501';
  end if;
  if p_generation_mode not in ('fast', 'llm')
    or p_public_access_token_hash !~ '^[a-f0-9]{64}$'
    or nullif(btrim(p_title), '') is null
    or char_length(btrim(p_title)) > 120
  then
    raise exception 'Invalid QR show request.' using errcode = '22023';
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
    and selection.music_analysis_id is not null
  for share;
  if not found or not exists (
    select 1 from public.song_analyses analysis
    where analysis.id = selection_row.music_analysis_id
      and analysis.user_id = link_row.funding_user_id
      and analysis.status in ('running', 'completed')
  ) then
    raise exception 'Song selection unavailable.' using errcode = 'P0002';
  end if;

  if p_source_show_id is not null then
    select * into source_show_row
    from public.shows source_show
    where source_show.id = p_source_show_id
      and source_show.user_id = link_row.funding_user_id
      and source_show.creation_source = 'assortment_qr'
      and source_show.assortment_id = assortment_row.id
      and source_show.assortment_song_selection_id = selection_row.id
    for share;
    if not found then
      raise exception 'Source show unavailable.' using errcode = 'P0002';
    end if;

    select count(*)::integer into item_count
    from public.show_assortment_items snapshot
    where snapshot.show_id = source_show_row.id;
  else
    select count(*)::integer into item_count
    from public.assortment_items item
    where item.assortment_id = assortment_row.id;
  end if;
  if item_count = 0 then
    raise exception 'Assortment unavailable.' using errcode = 'P0002';
  end if;

  insert into public.shows (
    id,
    user_id,
    slug,
    title,
    song,
    status,
    duration_seconds,
    budget_cents,
    time_of_day,
    description,
    audio_path,
    music_analysis_id,
    cover_shader,
    show_style,
    selected_cue_model,
    generation_status,
    generation_started_at,
    assortment_id,
    assortment_song_selection_id,
    creation_source,
    public_access_token_hash
  ) values (
    new_show_id,
    link_row.funding_user_id,
    show_slug,
    btrim(p_title),
    selection_row.original_filename,
    'draft',
    null,
    case
      when p_source_show_id is not null then source_show_row.budget_cents
      else assortment_row.price_cents
    end,
    'night',
    'Generated from the fixed ' || assortment_row.name || ' assortment QR.',
    selection_row.audio_path,
    selection_row.music_analysis_id,
    p_cover_shader,
    'signature',
    case when p_generation_mode = 'llm' then p_selected_cue_model else null end,
    'running',
    now(),
    assortment_row.id,
    selection_row.id,
    'assortment_qr',
    p_public_access_token_hash
  );

  if p_source_show_id is not null then
    insert into public.show_assortment_items (show_id, catalogue_item_id, quantity)
    select new_show_id, snapshot.catalogue_item_id, snapshot.quantity
    from public.show_assortment_items snapshot
    where snapshot.show_id = source_show_row.id;
  else
    insert into public.show_assortment_items (show_id, catalogue_item_id, quantity)
    select new_show_id, item.catalogue_item_id, item.quantity
    from public.assortment_items item
    where item.assortment_id = assortment_row.id;
  end if;

  perform private.reserve_assortment_ai_credit(
    link_row.funding_user_id,
    p_credit_action_key,
    'shows',
    new_show_id,
    'show-generation:' || new_show_id::text || ':reserve',
    jsonb_build_object(
      'assortmentId', assortment_row.id,
      'generationMode', p_generation_mode,
      'model', case when p_generation_mode = 'llm' then p_selected_cue_model else null end,
      'sourceShowId', p_source_show_id,
      'source', 'assortment_qr'
    )
  );

  return jsonb_build_object(
    'ok', true,
    'showId', new_show_id,
    'showSlug', show_slug,
    'fundingUserId', link_row.funding_user_id,
    'musicAnalysisId', selection_row.music_analysis_id
  );
end;
$_$;

ALTER FUNCTION "public"."create_assortment_qr_show"("p_assortment_token" "text", "p_selection_id" "uuid", "p_public_access_token_hash" "text", "p_title" "text", "p_generation_mode" "text", "p_selected_cue_model" "text", "p_credit_action_key" "text", "p_cover_shader" "jsonb", "p_source_show_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."delete_show_timeline_item"("p_cue_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  actor_id uuid := (select auth.uid());
  target_show_id uuid;
begin
  if actor_id is null
    or not coalesce(public.current_user_is_active(), false)
  then
    raise exception using
      errcode = '42501',
      message = 'Not permitted.';
  end if;

  if p_cue_id is null then
    raise exception using
      errcode = '22023',
      message = 'Invalid timeline item.';
  end if;

  select timeline_item.show_id
  into target_show_id
  from public.show_timeline_items timeline_item
  join public.shows show_row
    on show_row.id = timeline_item.show_id
  where timeline_item.id = p_cue_id
    and show_row.user_id = actor_id
  for update of show_row;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Timeline item was not found.';
  end if;

  delete from public.show_timeline_items timeline_item
  where timeline_item.id = p_cue_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Timeline item was not found.';
  end if;

  return target_show_id;
end;
$$;

ALTER FUNCTION "public"."delete_show_timeline_item"("p_cue_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."ensure_assortment_public_link"("p_assortment_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  actor_id uuid := auth.uid();
  link_row public.assortment_public_links;
begin
  if actor_id is null
    or not coalesce(public.current_user_is_active(), false)
    or not public.current_user_has_permission('admin.manage_assortments')
  then
    raise exception 'Not permitted.' using errcode = '42501';
  end if;
  perform 1 from public.assortments assortment
  where assortment.id = p_assortment_id
  for update;
  if not found then
    raise exception 'Assortment not found.' using errcode = 'P0002';
  end if;

  insert into public.assortment_public_links (assortment_id, funding_user_id)
  values (p_assortment_id, actor_id)
  on conflict (assortment_id) do nothing;

  select * into link_row
  from public.assortment_public_links link
  where link.assortment_id = p_assortment_id;

  return jsonb_build_object(
    'publicToken', link_row.public_token,
    'isEnabled', link_row.is_enabled,
    'fundingUserId', link_row.funding_user_id
  );
end;
$$;

ALTER FUNCTION "public"."ensure_assortment_public_link"("p_assortment_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."prepare_assortment_jamendo_selection"("p_assortment_token" "text", "p_selection_id" "uuid", "p_access_token_hash" "text", "p_audio_path" "text", "p_original_filename" "text", "p_content_type" "text", "p_size_bytes" bigint, "p_new_analysis_id" "uuid", "p_source_track_id" "text", "p_source_title" "text", "p_source_artist" "text", "p_source_url" "text", "p_source_licence_name" "text", "p_source_licence_url" "text", "p_reusable_analysis_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  link_row public.assortment_public_links;
  assortment_row public.assortments;
  reusable_analysis public.song_analyses;
  selected_analysis_id uuid;
  selected_audio_path text;
  selected_original_filename text;
  selected_content_type text;
  selected_size_bytes bigint;
  reused boolean := false;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Not permitted.' using errcode = '42501';
  end if;
  if p_access_token_hash !~ '^[a-f0-9]{64}$'
    or p_source_track_id !~ '^[0-9]{1,24}$'
    or p_source_url <> ('https://www.jamendo.com/track/' || p_source_track_id)
    or p_source_licence_name !~ '^(CC BY|CC0) [0-9]'
    or p_source_licence_url !~ '^https://creativecommons[.]org/(licenses/by|publicdomain/zero)/'
  then
    raise exception 'Invalid Jamendo selection.' using errcode = '22023';
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
  if not found or not exists (
    select 1 from public.users funding_user
    where funding_user.id = link_row.funding_user_id
      and funding_user.status = 'active'
  ) then
    raise exception 'Assortment unavailable.' using errcode = 'P0002';
  end if;

  if p_reusable_analysis_id is not null then
    select * into reusable_analysis
    from public.song_analyses analysis
    where analysis.id = p_reusable_analysis_id
      and analysis.user_id = link_row.funding_user_id
      and analysis.source_provider = 'jamendo'
      and analysis.source_track_id = p_source_track_id
      and analysis.status = 'completed'
      and analysis.analysis_json is not null
      and analysis.content_type is not null
      and analysis.size_bytes between 1 and 52428800
      and exists (
        select 1 from public.shows show_row
        where show_row.user_id = link_row.funding_user_id
          and show_row.music_analysis_id = analysis.id
      )
    for share;
    if not found then
      raise exception 'Reusable analysis unavailable.' using errcode = 'P0002';
    end if;

    selected_analysis_id := reusable_analysis.id;
    selected_audio_path := reusable_analysis.audio_path;
    selected_original_filename := reusable_analysis.original_filename;
    selected_content_type := reusable_analysis.content_type;
    selected_size_bytes := reusable_analysis.size_bytes;
    reused := true;
  else
    if p_new_analysis_id is null
      or p_content_type <> 'audio/mpeg'
      or p_size_bytes not between 1 and 52428800
      or p_audio_path <> (link_row.funding_user_id::text || '/assortment-qr/jamendo/'
        || p_selection_id::text || '-' || p_original_filename)
      or nullif(btrim(p_original_filename), '') is null
      or char_length(p_original_filename) > 180
      or nullif(btrim(p_source_title), '') is null
      or nullif(btrim(p_source_artist), '') is null
    then
      raise exception 'Invalid Jamendo selection.' using errcode = '22023';
    end if;

    perform private.reserve_assortment_ai_credit(
      link_row.funding_user_id,
      'music_analysis',
      'song_analyses',
      p_new_analysis_id,
      'music-analysis:' || p_new_analysis_id::text || ':reserve',
      jsonb_build_object(
        'assortmentId', assortment_row.id,
        'source', 'assortment_qr_jamendo',
        'audioPath', p_audio_path,
        'contentType', p_content_type,
        'sizeBytes', p_size_bytes,
        'sourceProvider', 'jamendo',
        'sourceTrackId', p_source_track_id
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
      schema_version,
      source_provider,
      source_track_id,
      source_title,
      source_artist,
      source_url,
      source_licence_name,
      source_licence_url
    ) values (
      p_new_analysis_id,
      link_row.funding_user_id,
      p_audio_path,
      p_original_filename,
      p_content_type,
      p_size_bytes,
      'balanced',
      'running',
      'modal-librosa-2',
      '1.4.0',
      'jamendo',
      p_source_track_id,
      p_source_title,
      p_source_artist,
      p_source_url,
      p_source_licence_name,
      p_source_licence_url
    );

    selected_analysis_id := p_new_analysis_id;
    selected_audio_path := p_audio_path;
    selected_original_filename := p_original_filename;
    selected_content_type := p_content_type;
    selected_size_bytes := p_size_bytes;
  end if;

  insert into public.assortment_song_selections (
    id,
    assortment_id,
    funding_user_id,
    access_token_hash,
    audio_path,
    original_filename,
    content_type,
    size_bytes,
    music_analysis_id
  ) values (
    p_selection_id,
    assortment_row.id,
    link_row.funding_user_id,
    p_access_token_hash,
    selected_audio_path,
    selected_original_filename,
    selected_content_type,
    selected_size_bytes,
    selected_analysis_id
  );

  return jsonb_build_object(
    'ok', true,
    'analysisId', selected_analysis_id,
    'fundingUserId', link_row.funding_user_id,
    'reusedAnalysis', reused
  );
end;
$_$;

ALTER FUNCTION "public"."prepare_assortment_jamendo_selection"("p_assortment_token" "text", "p_selection_id" "uuid", "p_access_token_hash" "text", "p_audio_path" "text", "p_original_filename" "text", "p_content_type" "text", "p_size_bytes" bigint, "p_new_analysis_id" "uuid", "p_source_track_id" "text", "p_source_title" "text", "p_source_artist" "text", "p_source_url" "text", "p_source_licence_name" "text", "p_source_licence_url" "text", "p_reusable_analysis_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."replace_show_timeline_items"("p_show_id" "uuid", "p_user_id" "uuid", "p_items" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  actor_id uuid := auth.uid();
  actor_role text := auth.role();
  target_show public.shows;
  replaced_count integer := 0;
begin
  if actor_role is distinct from 'service_role' and (
    actor_id is null
    or p_user_id is distinct from actor_id
    or not coalesce(public.current_user_is_active(), false)
  ) then
    raise exception 'Not permitted.' using errcode = '42501';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array'
    or jsonb_array_length(p_items) = 0
  then
    raise exception 'Timeline replacement payload must contain at least one cue.'
      using errcode = '22023';
  end if;

  select * into target_show
  from public.shows show_row
  where show_row.id = p_show_id
    and show_row.user_id = p_user_id
  for update;
  if not found then
    raise exception 'Show was not found.' using errcode = 'P0002';
  end if;

  if actor_role = 'service_role' then
    if target_show.creation_source <> 'assortment_qr' then
      raise exception 'Service-role timeline replacement is limited to QR shows.'
        using errcode = '42501';
    end if;
  end if;

  if target_show.creation_source = 'assortment_qr' and (
    not exists (
      select 1 from public.show_assortment_items snapshot
      where snapshot.show_id = target_show.id
    )
    or exists (
      select 1
      from jsonb_to_recordset(p_items) as cue(catalogue_item_id uuid)
      left join public.show_assortment_items snapshot
        on snapshot.show_id = target_show.id
        and snapshot.catalogue_item_id = cue.catalogue_item_id
      where cue.catalogue_item_id is null
        or snapshot.catalogue_item_id is null
    )
    or exists (
      select 1
      from public.show_assortment_items snapshot
      where snapshot.show_id = target_show.id
        and (
          select count(*)
          from jsonb_to_recordset(p_items) as cue(catalogue_item_id uuid)
          where cue.catalogue_item_id = snapshot.catalogue_item_id
        ) <> snapshot.quantity
    )
  ) then
    raise exception 'Generated cues must consume every assortment product exactly once per purchased unit.'
      using errcode = '23514';
  end if;

  delete from public.show_timeline_items timeline_item
  where timeline_item.show_id = p_show_id;

  insert into public.show_timeline_items (
    show_id,
    position,
    time_seconds,
    description,
    catalogue_item_id,
    launch_position_index,
    emphasis
  )
  select
    p_show_id,
    cue.position,
    cue.time_seconds,
    cue.description,
    cue.catalogue_item_id,
    cue.launch_position_index,
    cue.emphasis
  from jsonb_to_recordset(p_items) as cue(
    position integer,
    time_seconds numeric,
    description text,
    catalogue_item_id uuid,
    launch_position_index integer,
    emphasis text
  )
  order by cue.position;

  get diagnostics replaced_count = row_count;
  return replaced_count;
end;
$$;

ALTER FUNCTION "public"."replace_show_timeline_items"("p_show_id" "uuid", "p_user_id" "uuid", "p_items" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."sync_show_preset_like_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if tg_op = 'INSERT' then
    insert into public.show_preset_like_counts (show_preset_id, like_count)
    values (new.show_preset_id, 1)
    on conflict (show_preset_id) do update
    set like_count = public.show_preset_like_counts.like_count + 1;
    return new;
  end if;

  update public.show_preset_like_counts
  set like_count = greatest(like_count - 1, 0)
  where show_preset_id = old.show_preset_id;
  return old;
end;
$$;

ALTER FUNCTION "public"."sync_show_preset_like_count"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."toggle_show_preset_like"("p_show_preset_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  caller_id uuid := auth.uid();
  current_count integer := 0;
  is_liked boolean;
begin
  if caller_id is null
    or not coalesce(public.current_user_is_active(), false)
  then
    return jsonb_build_object('ok', false, 'error', 'Not permitted.');
  end if;

  if not exists (
    select 1
    from public.show_presets
    where id = p_show_preset_id
      and is_published
  ) then
    return jsonb_build_object('ok', false, 'error', 'Published show was not found.');
  end if;

  delete from public.show_preset_likes
  where show_preset_id = p_show_preset_id
    and user_id = caller_id;

  if found then
    is_liked := false;
  else
    insert into public.show_preset_likes (show_preset_id, user_id)
    values (p_show_preset_id, caller_id)
    on conflict (show_preset_id, user_id) do nothing;
    is_liked := true;
  end if;

  select like_count into current_count
  from public.show_preset_like_counts
  where show_preset_id = p_show_preset_id;

  return jsonb_build_object(
    'ok', true,
    'liked', is_liked,
    'likeCount', coalesce(current_count, 0)
  );
end;
$$;

ALTER FUNCTION "public"."toggle_show_preset_like"("p_show_preset_id" "uuid") OWNER TO "postgres";
