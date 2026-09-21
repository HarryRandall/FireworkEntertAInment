-- ShowCrafter baseline: catalogue.
set check_function_bodies = false;

CREATE OR REPLACE FUNCTION "private"."bump_effect_preview_images"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  update public.firework_preview_images preview
  set source_revision = preview.source_revision + 1,
      renderer_version = null,
      source_signature = null,
      storage_path = null,
      width = null,
      height = null,
      captured_at = null,
      updated_at = now()
  where preview.firework_effect_id = new.id
     or preview.firework_id in (
       select firework.id
       from public.fireworks firework
       where firework.firework_effect_id = new.id
     )
     or preview.multishot_id in (
       select distinct shot.multishot_id
       from public.multishot_fireworks shot
       join public.fireworks firework on firework.id = shot.firework_id
       where firework.firework_effect_id = new.id
     );
  return new;
end;
$$;

ALTER FUNCTION "private"."bump_effect_preview_images"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."bump_firework_preview_images"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  update public.firework_preview_images preview
  set source_revision = preview.source_revision + 1,
      renderer_version = null,
      source_signature = null,
      storage_path = null,
      width = null,
      height = null,
      captured_at = null,
      updated_at = now()
  where preview.firework_id = new.id
     or preview.multishot_id in (
       select distinct shot.multishot_id
       from public.multishot_fireworks shot
       where shot.firework_id = new.id
     );
  return new;
end;
$$;

ALTER FUNCTION "private"."bump_firework_preview_images"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."bump_multishot_preview_image"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  update public.firework_preview_images preview
  set source_revision = preview.source_revision + 1,
      renderer_version = null,
      source_signature = null,
      storage_path = null,
      width = null,
      height = null,
      captured_at = null,
      updated_at = now()
  where preview.multishot_id = new.id;
  return new;
end;
$$;

ALTER FUNCTION "private"."bump_multishot_preview_image"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."catalogue_item_occupied_launch_positions"("p_catalogue_item_id" "uuid", "p_parent_launch_position_index" integer) RETURNS integer[]
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
  with raw_child_positions as (
    select case
      when jsonb_typeof(shot.position_override_json -> 'launchPositionIndex') = 'number'
        then (shot.position_override_json ->> 'launchPositionIndex')::numeric
      when jsonb_typeof(shot.position_override_json -> 'launchPositionIndex') = 'string'
        and char_length(btrim(shot.position_override_json ->> 'launchPositionIndex'))
          between 1 and 64
        and btrim(shot.position_override_json ->> 'launchPositionIndex')
          ~ '^[+-]?(([0-9]+([.][0-9]*)?)|([.][0-9]+))([eE][+-]?[0-9]{1,3})?$'
        then btrim(shot.position_override_json ->> 'launchPositionIndex')::numeric
      else null
    end as launch_position_index
    from public.catalogue_items item
    join public.multishot_fireworks shot
      on shot.multishot_id = item.multishot_id
    where item.id = p_catalogue_item_id
  ),
  valid_child_positions as (
    select launch_position_index::integer as launch_position_index
    from raw_child_positions
    where launch_position_index between 0 and 2
      and launch_position_index = trunc(launch_position_index)
  )
  select coalesce(
    array_agg(
      distinct occupied.launch_position_index
      order by occupied.launch_position_index
    ),
    array[]::integer[]
  )
  from (
    select p_parent_launch_position_index as launch_position_index
    where p_parent_launch_position_index between 0 and 2
    union all
    select child.launch_position_index
    from valid_child_positions child
  ) occupied;
$_$;

ALTER FUNCTION "private"."catalogue_item_occupied_launch_positions"("p_catalogue_item_id" "uuid", "p_parent_launch_position_index" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."catalogue_item_safe_duration"("p_catalogue_item_id" "uuid") RETURNS numeric
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select greatest(
    coalesce(item.duration_seconds, 0::numeric),
    coalesce(direct_firework.duration_seconds, 0::numeric),
    coalesce(
      (
        select ceil(
          max(
            shot.time_offset_seconds
            + greatest(
              coalesce(
                (
                  select max(child_item.duration_seconds)
                  from public.catalogue_items child_item
                  where child_item.firework_id = shot.firework_id
                    and child_item.duration_seconds is not null
                ),
                0::numeric
              ),
              coalesce(child_firework.duration_seconds, 0::numeric),
              0.5::numeric
            )
          ) * 100
        ) / 100
        from public.multishot_fireworks shot
        left join public.fireworks child_firework
          on child_firework.id = shot.firework_id
        where shot.multishot_id = item.multishot_id
      ),
      0::numeric
    ),
    0.5::numeric
  )
  from public.catalogue_items item
  left join public.fireworks direct_firework
    on direct_firework.id = item.firework_id
  where item.id = p_catalogue_item_id;
$$;

ALTER FUNCTION "private"."catalogue_item_safe_duration"("p_catalogue_item_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."enforce_multishot_minimum_duration"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  minimum_duration numeric := private.multishot_minimum_duration(new.id);
begin
  if minimum_duration > 0 and new.duration_seconds is null then
    new.duration_seconds := minimum_duration;
  elsif new.duration_seconds is not null and new.duration_seconds < minimum_duration then
    raise exception 'Multishot duration must be at least % seconds.', minimum_duration
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

ALTER FUNCTION "private"."enforce_multishot_minimum_duration"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."ensure_firework_preview_image"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if tg_table_name = 'firework_effects' then
    insert into public.firework_preview_images (firework_effect_id)
    values (new.id)
    on conflict (firework_effect_id) do nothing;
  elsif tg_table_name = 'fireworks' then
    insert into public.firework_preview_images (firework_id)
    values (new.id)
    on conflict (firework_id) do nothing;
  elsif tg_table_name = 'multishots' then
    insert into public.firework_preview_images (multishot_id)
    values (new.id)
    on conflict (multishot_id) do nothing;
  end if;
  return new;
end;
$$;

ALTER FUNCTION "private"."ensure_firework_preview_image"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."multishot_minimum_duration"("p_multishot_id" "uuid") RETURNS numeric
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select coalesce(
    ceil(
      max(
        shot.time_offset_seconds
        + greatest(
          coalesce(
            (
              select max(item.duration_seconds)
              from public.catalogue_items item
              where item.firework_id = shot.firework_id
                and item.duration_seconds is not null
            ),
            0::numeric
          ),
          coalesce(firework.duration_seconds, 0::numeric),
          0.5::numeric
        )
      ) * 100
    ) / 100,
    0::numeric
  )
  from public.multishot_fireworks shot
  left join public.fireworks firework on firework.id = shot.firework_id
  where shot.multishot_id = p_multishot_id;
$$;

ALTER FUNCTION "private"."multishot_minimum_duration"("p_multishot_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."raise_catalogue_multishot_duration"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if new.duration_seconds is not null then
    update public.catalogue_items
    set duration_seconds = new.duration_seconds
    where multishot_id = new.id
      and (
        duration_seconds is null
        or duration_seconds < new.duration_seconds
      );
  end if;

  return new;
end;
$$;

ALTER FUNCTION "private"."raise_catalogue_multishot_duration"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."sync_multishot_derived_state"("p_multishot_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  derived_shot_count integer;
  minimum_duration numeric;
  next_duration numeric;
begin
  perform 1
  from public.multishots
  where id = p_multishot_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Multishot was not found.');
  end if;

  select count(*)::integer
  into derived_shot_count
  from public.multishot_fireworks
  where multishot_id = p_multishot_id;

  minimum_duration := private.multishot_minimum_duration(p_multishot_id);
  if minimum_duration > 3600 then
    raise exception 'Multishot requires % seconds, above the supported 3600 second duration.',
      minimum_duration
      using errcode = 'check_violation';
  end if;

  update public.multishots
  set shot_count = derived_shot_count,
      duration_seconds = case
        when minimum_duration > 0
          and (duration_seconds is null or duration_seconds < minimum_duration)
          then minimum_duration
        else duration_seconds
      end
  where id = p_multishot_id
  returning duration_seconds into next_duration;

  return jsonb_build_object(
    'ok', true,
    'shotCount', derived_shot_count,
    'minimumDurationSeconds', minimum_duration,
    'durationSeconds', next_duration
  );
end;
$$;

ALTER FUNCTION "private"."sync_multishot_derived_state"("p_multishot_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."sync_multishot_derived_state_from_shot"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if tg_op = 'UPDATE'
    and (pg_catalog.to_jsonb(old) - 'timeline_track_index')
      is not distinct from
      (pg_catalog.to_jsonb(new) - 'timeline_track_index')
  then
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform private.sync_multishot_derived_state(old.multishot_id);
    return old;
  end if;

  perform private.sync_multishot_derived_state(new.multishot_id);
  if tg_op = 'UPDATE' and old.multishot_id <> new.multishot_id then
    perform private.sync_multishot_derived_state(old.multishot_id);
  end if;
  return new;
end;
$$;

ALTER FUNCTION "private"."sync_multishot_derived_state_from_shot"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."sync_multishots_for_firework"("p_firework_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  target_multishot_id uuid;
begin
  if p_firework_id is null then
    return;
  end if;

  for target_multishot_id in
    select distinct shot.multishot_id
    from public.multishot_fireworks shot
    where shot.firework_id = p_firework_id
    order by shot.multishot_id
  loop
    perform private.sync_multishot_derived_state(target_multishot_id);
  end loop;
end;
$$;

ALTER FUNCTION "private"."sync_multishots_for_firework"("p_firework_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."sync_multishots_from_catalogue_duration"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  perform private.sync_multishots_for_firework(new.firework_id);
  if tg_op = 'UPDATE' and old.firework_id is distinct from new.firework_id then
    perform private.sync_multishots_for_firework(old.firework_id);
  end if;
  return new;
end;
$$;

ALTER FUNCTION "private"."sync_multishots_from_catalogue_duration"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."sync_multishots_from_firework_duration"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  perform private.sync_multishots_for_firework(new.id);
  return new;
end;
$$;

ALTER FUNCTION "private"."sync_multishots_from_firework_duration"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."validate_catalogue_timing_dependencies"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  affected_catalogue_item_id uuid;
begin
  for affected_catalogue_item_id in
    select new.id
    union
    select parent_item.id
    from public.multishot_fireworks shot
    join public.catalogue_items parent_item
      on parent_item.multishot_id = shot.multishot_id
    where shot.firework_id = new.firework_id
      or (tg_op = 'UPDATE' and shot.firework_id = old.firework_id)
  loop
    perform private.assert_published_presets_for_catalogue_item(
      affected_catalogue_item_id
    );
  end loop;
  return new;
end;
$$;

ALTER FUNCTION "private"."validate_catalogue_timing_dependencies"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."validate_firework_timing_dependencies"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  affected_catalogue_item_id uuid;
begin
  for affected_catalogue_item_id in
    select item.id
    from public.catalogue_items item
    where item.firework_id = new.id
    union
    select parent_item.id
    from public.multishot_fireworks shot
    join public.catalogue_items parent_item
      on parent_item.multishot_id = shot.multishot_id
    where shot.firework_id = new.id
  loop
    perform private.assert_published_presets_for_catalogue_item(
      affected_catalogue_item_id
    );
  end loop;
  return new;
end;
$$;

ALTER FUNCTION "private"."validate_firework_timing_dependencies"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."validate_multishot_shot_timing_dependencies"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  target_multishot_ids uuid[];
  affected_catalogue_item_id uuid;
begin
  if tg_op = 'DELETE' then
    target_multishot_ids := array[old.multishot_id];
  elsif tg_op = 'INSERT' then
    target_multishot_ids := array[new.multishot_id];
  else
    target_multishot_ids := array[new.multishot_id, old.multishot_id];
  end if;

  for affected_catalogue_item_id in
    select item.id
    from public.catalogue_items item
    where item.multishot_id = any(target_multishot_ids)
  loop
    perform private.assert_published_presets_for_catalogue_item(
      affected_catalogue_item_id
    );
  end loop;
  return null;
end;
$$;

ALTER FUNCTION "private"."validate_multishot_shot_timing_dependencies"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."block_linked_catalogue_item_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if old.firework_id is not null or old.multishot_id is not null then
    raise exception 'Catalogue item % is linked to a firework or multishot and cannot be deleted.', old.id
      using errcode = 'restrict_violation';
  end if;

  if exists (
    select 1
    from public.show_presets preset
    where preset.is_published
      and exists (
        select 1
        from jsonb_array_elements(preset.preview_cues) as cue_item(cue)
        where cue->>'catalogueItemId' = old.id::text
      )
  ) then
    raise exception 'Catalogue item % is used by a published show preset and cannot be deleted.', old.id
      using errcode = 'restrict_violation';
  end if;

  return old;
end;
$$;

ALTER FUNCTION "public"."block_linked_catalogue_item_delete"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_style_default_and_update_effect"("p_effect_id" "uuid", "p_expected_updated_at" timestamp with time zone, "p_effect_name" "text", "p_effect_description" "text", "p_pattern_key" "text", "p_sort_order" integer, "p_model_json" "jsonb", "p_style_slug" "text", "p_style_name" "text", "p_style_description" "text", "p_style_kind" "text", "p_style_defaults_json" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_effect public.firework_effects%rowtype;
  v_style_default public.firework_style_defaults%rowtype;
begin
  if auth.uid() is null
    or not coalesce(public.current_user_has_permission('admin.manage_catalogue'), false) then
    raise exception using
      errcode = '42501',
      message = 'Not permitted.';
  end if;

  if p_effect_id is null
    or p_expected_updated_at is null
    or coalesce(trim(p_effect_name), '') = ''
    or coalesce(trim(p_pattern_key), '') = ''
    or p_sort_order is null
    or p_model_json is null
    or jsonb_typeof(p_model_json) <> 'object'
    or coalesce(trim(p_style_slug), '') = ''
    or coalesce(trim(p_style_name), '') = ''
    or p_style_kind is null
    or p_style_kind not in (
      'geometry',
      'star',
      'trail',
      'launch',
      'smoke',
      'strobe',
      'crackle',
      'split',
      'sound'
    )
    or p_style_defaults_json is null
    or jsonb_typeof(p_style_defaults_json) <> 'object' then
    raise exception using
      errcode = '22023',
      message = 'Invalid editor style-default request.';
  end if;

  update public.firework_effects
  set
    name = p_effect_name,
    description = nullif(p_effect_description, ''),
    pattern_key = p_pattern_key,
    sort_order = p_sort_order,
    model_json = p_model_json
  where id = p_effect_id
    and updated_at = p_expected_updated_at
  returning * into v_effect;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'conflict');
  end if;

  insert into public.firework_style_defaults (
    slug,
    name,
    description,
    kind,
    defaults_json,
    sort_order
  )
  values (
    p_style_slug,
    p_style_name,
    nullif(p_style_description, ''),
    p_style_kind,
    p_style_defaults_json,
    9000
  )
  returning * into v_style_default;

  return jsonb_build_object(
    'ok', true,
    'effect', to_jsonb(v_effect),
    'styleDefault', to_jsonb(v_style_default)
  );
end;
$$;

ALTER FUNCTION "public"."create_style_default_and_update_effect"("p_effect_id" "uuid", "p_expected_updated_at" timestamp with time zone, "p_effect_name" "text", "p_effect_description" "text", "p_pattern_key" "text", "p_sort_order" integer, "p_model_json" "jsonb", "p_style_slug" "text", "p_style_name" "text", "p_style_description" "text", "p_style_kind" "text", "p_style_defaults_json" "jsonb") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."create_style_default_and_update_effect"("p_effect_id" "uuid", "p_expected_updated_at" timestamp with time zone, "p_effect_name" "text", "p_effect_description" "text", "p_pattern_key" "text", "p_sort_order" integer, "p_model_json" "jsonb", "p_style_slug" "text", "p_style_name" "text", "p_style_description" "text", "p_style_kind" "text", "p_style_defaults_json" "jsonb") IS 'Atomically updates one effect with conflict detection and creates an inline editor style default.';

CREATE OR REPLACE FUNCTION "public"."create_style_default_and_update_firework"("p_firework_id" "uuid", "p_expected_updated_at" timestamp with time zone, "p_firework_name" "text", "p_firework_description" "text", "p_firework_effect_id" "uuid", "p_caliber" "text", "p_duration_seconds" numeric, "p_height_meters" numeric, "p_primary_color" "text", "p_secondary_color" "text", "p_color_palette" "text"[], "p_render_overrides_json" "jsonb", "p_style_slug" "text", "p_style_name" "text", "p_style_description" "text", "p_style_kind" "text", "p_style_defaults_json" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_firework public.fireworks%rowtype;
  v_style_default public.firework_style_defaults%rowtype;
begin
  if auth.uid() is null
    or not coalesce(public.current_user_has_permission('admin.manage_catalogue'), false) then
    raise exception using
      errcode = '42501',
      message = 'Not permitted.';
  end if;

  if p_firework_id is null
    or p_expected_updated_at is null
    or coalesce(trim(p_firework_name), '') = ''
    or p_firework_effect_id is null
    or p_render_overrides_json is null
    or jsonb_typeof(p_render_overrides_json) <> 'object'
    or coalesce(trim(p_style_slug), '') = ''
    or coalesce(trim(p_style_name), '') = ''
    or p_style_kind is null
    or p_style_kind not in (
      'geometry',
      'star',
      'trail',
      'launch',
      'smoke',
      'strobe',
      'crackle',
      'split',
      'sound'
    )
    or p_style_defaults_json is null
    or jsonb_typeof(p_style_defaults_json) <> 'object' then
    raise exception using
      errcode = '22023',
      message = 'Invalid editor style-default request.';
  end if;

  update public.fireworks
  set
    name = p_firework_name,
    description = p_firework_description,
    firework_effect_id = p_firework_effect_id,
    caliber = p_caliber,
    duration_seconds = p_duration_seconds,
    height_meters = p_height_meters,
    primary_color = p_primary_color,
    secondary_color = p_secondary_color,
    color_palette = coalesce(p_color_palette, '{}'::text[]),
    render_overrides_json = p_render_overrides_json,
    updated_at = clock_timestamp()
  where id = p_firework_id
    and updated_at = p_expected_updated_at
  returning * into v_firework;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'conflict');
  end if;

  insert into public.firework_style_defaults (
    slug,
    name,
    description,
    kind,
    defaults_json,
    sort_order
  )
  values (
    p_style_slug,
    p_style_name,
    p_style_description,
    p_style_kind,
    p_style_defaults_json,
    9000
  )
  returning * into v_style_default;

  return jsonb_build_object(
    'ok', true,
    'firework', to_jsonb(v_firework),
    'styleDefault', to_jsonb(v_style_default)
  );
end;
$$;

ALTER FUNCTION "public"."create_style_default_and_update_firework"("p_firework_id" "uuid", "p_expected_updated_at" timestamp with time zone, "p_firework_name" "text", "p_firework_description" "text", "p_firework_effect_id" "uuid", "p_caliber" "text", "p_duration_seconds" numeric, "p_height_meters" numeric, "p_primary_color" "text", "p_secondary_color" "text", "p_color_palette" "text"[], "p_render_overrides_json" "jsonb", "p_style_slug" "text", "p_style_name" "text", "p_style_description" "text", "p_style_kind" "text", "p_style_defaults_json" "jsonb") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."create_style_default_and_update_firework"("p_firework_id" "uuid", "p_expected_updated_at" timestamp with time zone, "p_firework_name" "text", "p_firework_description" "text", "p_firework_effect_id" "uuid", "p_caliber" "text", "p_duration_seconds" numeric, "p_height_meters" numeric, "p_primary_color" "text", "p_secondary_color" "text", "p_color_palette" "text"[], "p_render_overrides_json" "jsonb", "p_style_slug" "text", "p_style_name" "text", "p_style_description" "text", "p_style_kind" "text", "p_style_defaults_json" "jsonb") IS 'Atomically updates one firework with conflict detection and creates an inline editor style default.';

CREATE OR REPLACE FUNCTION "public"."ensure_catalogue_item_for_firework"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.catalogue_items (
    part_number, name, description, catalogue_item_kind,
    firework_id, duration_seconds
  )
  values (
    coalesce(nullif(new.slug, ''), 'fw-' || left(replace(new.id::text, '-', ''), 8)),
    new.name,
    new.description,
    'firework',
    new.id,
    new.duration_seconds
  )
  on conflict do nothing;
  return new;
end;
$$;

ALTER FUNCTION "public"."ensure_catalogue_item_for_firework"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."ensure_catalogue_item_for_multishot"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  part_number_value text := coalesce(
    nullif(new.slug, ''),
    'ms-' || left(replace(new.id::text, '-', ''), 8)
  );
begin
  insert into public.catalogue_items (
    part_number,
    name,
    description,
    catalogue_item_kind,
    multishot_id,
    duration_seconds
  )
  values (
    part_number_value,
    new.name,
    new.description,
    'multishot',
    new.id,
    new.duration_seconds
  );

  return new;
end;
$$;

ALTER FUNCTION "public"."ensure_catalogue_item_for_multishot"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."sync_multishot_derived_state"("p_multishot_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if auth.uid() is null
    or not public.current_user_has_permission('admin.manage_catalogue') then
    return jsonb_build_object('ok', false, 'error', 'Not permitted.');
  end if;

  return private.sync_multishot_derived_state(p_multishot_id);
end;
$$;

ALTER FUNCTION "public"."sync_multishot_derived_state"("p_multishot_id" "uuid") OWNER TO "postgres";
