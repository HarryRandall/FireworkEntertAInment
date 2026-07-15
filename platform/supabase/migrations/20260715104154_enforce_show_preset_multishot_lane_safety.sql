-- Published presets must use the same conservative position model as generated
-- shows: a multishot reserves its parent position and every valid absolute
-- child override for the product's full safe duration.

lock table
  public.catalogue_items,
  public.fireworks,
  public.multishot_fireworks,
  public.show_presets
in share row exclusive mode;

create or replace function private.assert_show_preset_publishable(
  p_preset_id uuid,
  p_is_published boolean,
  p_published_at timestamptz,
  p_duration_seconds integer,
  p_preview_cues jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke execute on function private.assert_show_preset_publishable(
  uuid,
  boolean,
  timestamptz,
  integer,
  jsonb
) from public, anon, authenticated, service_role;

create or replace function private.assert_all_published_show_presets()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
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

revoke execute on function private.assert_all_published_show_presets()
  from public, anon, authenticated, service_role;

-- Fail closed before installing the broader dependency guard. Existing public
-- content must be repaired explicitly rather than silently rescheduled.
select private.assert_all_published_show_presets();

-- The corrected timeline-safety migration already serialises source changes
-- with an exclusive advisory lock. Extend its after-statement assertion so the
-- same transaction also protects every published preset.
create or replace function private.assert_show_timeline_after_source_mutation()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.assert_show_timeline_non_overlapping();
  perform private.assert_all_published_show_presets();
  return null;
end;
$$;

revoke execute on function private.assert_show_timeline_after_source_mutation()
  from public, anon, authenticated, service_role;

-- Preset writes take the matching shared lock before their existing row-level
-- publication trigger reads catalogue and multishot safety metadata.
drop trigger if exists show_presets_lock_timeline_sources
  on public.show_presets;
create trigger show_presets_lock_timeline_sources
before insert or update or delete on public.show_presets
for each statement
execute function private.lock_show_timeline_sources_shared();
