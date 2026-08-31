-- Published seed presets predated per-launch-position occupancy validation.
-- Keep every cue and its requested time where possible, move it to another
-- launch position when one is free, and only delay it when all three are busy.

-- The later multishot integrity migration persists its derived duration, but
-- this reusable helper computes it directly so migration ordering and future
-- supplier metadata edits cannot understate a product's occupancy.
create or replace function private.catalogue_item_safe_duration(
  p_catalogue_item_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
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

revoke execute on function private.catalogue_item_safe_duration(uuid)
  from public, anon, authenticated, service_role;

create temporary table safe_catalogue_item_durations on commit drop as
select
  item.id as catalogue_item_id,
  private.catalogue_item_safe_duration(item.id) as duration_seconds
from public.catalogue_items item;

create temporary table repaired_published_show_preset_cues (
  preset_id uuid primary key,
  preview_cues jsonb not null,
  duration_seconds integer not null,
  original_updated_at timestamptz not null,
  cue_count integer not null
) on commit drop;

do $$
declare
  preset_row record;
  cue_row record;
  busy_until numeric[];
  rebuilt_cues jsonb;
  original_time numeric;
  scheduled_time numeric;
  product_duration numeric;
  desired_lane integer;
  scheduled_lane integer;
  candidate_lane integer;
  found_free_lane boolean;
  latest_end numeric;
begin
  if exists (
    select 1
    from public.show_presets preset
    cross join lateral jsonb_array_elements(preset.preview_cues) as cue_item(cue)
    where preset.is_published
      and (
        jsonb_typeof(cue->'timeSeconds') is distinct from 'number'
        or (cue->>'timeSeconds')::numeric < 0
        or (
          cue ? 'launchPositionIndex'
          and jsonb_typeof(cue->'launchPositionIndex') is distinct from 'number'
        )
        or (
          cue ? 'emphasis'
          and (
            jsonb_typeof(cue->'emphasis') is distinct from 'string'
            or cue->>'emphasis' not in ('normal', 'accent', 'peak')
          )
        )
      )
  ) then
    raise exception 'Published show preset timing contains invalid numeric values.'
      using errcode = 'check_violation';
  end if;

  for preset_row in
    select id, preview_cues, duration_seconds, updated_at
    from public.show_presets
    where is_published
    order by id
  loop
    busy_until := array[0::numeric, 0::numeric, 0::numeric];
    rebuilt_cues := '[]'::jsonb;
    latest_end := 0;

    for cue_row in
      select cue, cue_index
      from jsonb_array_elements(preset_row.preview_cues)
        with ordinality as item(cue, cue_index)
      order by (cue->>'timeSeconds')::numeric, cue_index
    loop
      original_time := (cue_row.cue->>'timeSeconds')::numeric;
      desired_lane := greatest(
        0,
        least(2, round(coalesce((cue_row.cue->>'launchPositionIndex')::numeric, 0))::integer)
      );

      select item_duration.duration_seconds
      into product_duration
      from safe_catalogue_item_durations item_duration
      where item_duration.catalogue_item_id = (cue_row.cue->>'catalogueItemId')::uuid;

      if product_duration is null then
        raise exception 'Published show preset cue references a missing catalogue item.'
          using errcode = 'foreign_key_violation';
      end if;

      scheduled_lane := desired_lane;
      if busy_until[scheduled_lane + 1] > original_time then
        found_free_lane := false;
        for candidate_lane in 0..2 loop
          if busy_until[candidate_lane + 1] <= original_time then
            scheduled_lane := candidate_lane;
            found_free_lane := true;
            exit;
          end if;
        end loop;

        if not found_free_lane then
          scheduled_lane := 0;
          for candidate_lane in 1..2 loop
            if busy_until[candidate_lane + 1] < busy_until[scheduled_lane + 1] then
              scheduled_lane := candidate_lane;
            end if;
          end loop;
        end if;
      end if;

      scheduled_time := greatest(original_time, busy_until[scheduled_lane + 1]);
      busy_until[scheduled_lane + 1] := scheduled_time + product_duration;
      latest_end := greatest(latest_end, scheduled_time + product_duration);
      rebuilt_cues := rebuilt_cues || jsonb_build_array(
        (cue_row.cue - 'timeSeconds' - 'launchPositionIndex')
          || jsonb_build_object(
            'timeSeconds', round(scheduled_time, 2),
            'launchPositionIndex', scheduled_lane,
            'emphasis', coalesce(cue_row.cue->>'emphasis', 'normal')
          )
      );
    end loop;

    insert into repaired_published_show_preset_cues (
      preset_id,
      preview_cues,
      duration_seconds,
      original_updated_at,
      cue_count
    )
    values (
      preset_row.id,
      rebuilt_cues,
      greatest(coalesce(preset_row.duration_seconds, 1), ceil(latest_end)::integer),
      preset_row.updated_at,
      jsonb_array_length(preset_row.preview_cues)
    );
  end loop;
end;
$$;

-- Verify the repaired payload before touching durable rows.
do $$
begin
  if exists (
    select 1
    from repaired_published_show_preset_cues repaired
    cross join lateral jsonb_array_elements(repaired.preview_cues)
      with ordinality as first_cue(cue, cue_index)
    join safe_catalogue_item_durations first_item
      on first_item.catalogue_item_id = (first_cue.cue->>'catalogueItemId')::uuid
    cross join lateral jsonb_array_elements(repaired.preview_cues)
      with ordinality as second_cue(cue, cue_index)
    join safe_catalogue_item_durations second_item
      on second_item.catalogue_item_id = (second_cue.cue->>'catalogueItemId')::uuid
    where first_cue.cue_index < second_cue.cue_index
      and first_cue.cue->>'launchPositionIndex'
        = second_cue.cue->>'launchPositionIndex'
      and (first_cue.cue->>'timeSeconds')::numeric
        < (second_cue.cue->>'timeSeconds')::numeric
          + second_item.duration_seconds
      and (second_cue.cue->>'timeSeconds')::numeric
        < (first_cue.cue->>'timeSeconds')::numeric
          + first_item.duration_seconds
  ) then
    raise exception 'Published show preset repair still contains a launch-position overlap.'
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1
    from repaired_published_show_preset_cues repaired
    cross join lateral jsonb_array_elements(repaired.preview_cues) as cue_item(cue)
    join safe_catalogue_item_durations item
      on item.catalogue_item_id = (cue->>'catalogueItemId')::uuid
    where (cue->>'timeSeconds')::numeric
          + item.duration_seconds
        > repaired.duration_seconds
      or jsonb_array_length(repaired.preview_cues) <> repaired.cue_count
  ) then
    raise exception 'Published show preset repair changed cue counts or exceeded show duration.'
      using errcode = 'check_violation';
  end if;
end;
$$;

alter table public.show_presets disable trigger show_templates_set_updated_at;

update public.show_presets preset
set preview_cues = repaired.preview_cues,
    duration_seconds = repaired.duration_seconds,
    updated_at = repaired.original_updated_at
from repaired_published_show_preset_cues repaired
where preset.id = repaired.preset_id
  and (
    preset.preview_cues is distinct from repaired.preview_cues
    or preset.duration_seconds is distinct from repaired.duration_seconds
  );

alter table public.show_presets enable trigger show_templates_set_updated_at;

do $$
begin
  if exists (
    select 1
    from repaired_published_show_preset_cues repaired
    join public.show_presets preset on preset.id = repaired.preset_id
    where preset.preview_cues is distinct from repaired.preview_cues
      or preset.duration_seconds is distinct from repaired.duration_seconds
      or preset.updated_at is distinct from repaired.original_updated_at
  ) then
    raise exception 'Published show preset timing repair did not verify cleanly.';
  end if;
end;
$$;

-- Published presets are durable public records. Validate their JSON cue shape
-- and timing at the database boundary so direct API writes cannot bypass the
-- admin action's checks.
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

  -- Sort independently of JSON array order so same-lane occupancy validation
  -- remains correct for direct API payloads.
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

    if busy_until[launch_position + 1] > cue_time then
      raise exception 'Published show preset % cue % overlaps launch position %.',
        p_preset_id, cue_row.cue_index, launch_position
        using errcode = 'check_violation';
    end if;

    busy_until[launch_position + 1] := cue_time + product_duration;
  end loop;
end;
$$;

revoke execute on function private.assert_show_preset_publishable(
  uuid, boolean, timestamptz, integer, jsonb
) from public, anon, authenticated, service_role;

create or replace function private.validate_show_preset_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

revoke execute on function private.validate_show_preset_publication()
  from public, anon, authenticated, service_role;

-- Verify every repaired row before making the invariant durable.
do $$
declare
  preset public.show_presets%rowtype;
begin
  for preset in
    select * from public.show_presets where is_published order by id
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

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.show_presets'::regclass
      and conname = 'show_presets_published_shape'
  ) then
    alter table public.show_presets
      add constraint show_presets_published_shape
      check (
        not is_published
        or (
          duration_seconds is not null
          and duration_seconds > 0
          and published_at is not null
          and case
            when jsonb_typeof(preview_cues) = 'array'
              then jsonb_array_length(preview_cues) > 0
            else false
          end
        )
      );
  end if;
end;
$$;

drop trigger if exists show_presets_validate_publication on public.show_presets;
create trigger show_presets_validate_publication
  before insert or update on public.show_presets
  for each row execute function private.validate_show_preset_publication();

-- Revalidate affected published schedules when product timing changes. The
-- dependency fan-out includes multishots that contain the changed firework.
create or replace function private.assert_published_presets_for_catalogue_item(
  p_catalogue_item_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  preset public.show_presets%rowtype;
begin
  for preset in
    select show_preset.*
    from public.show_presets show_preset
    where show_preset.is_published
      and exists (
        select 1
        from jsonb_array_elements(show_preset.preview_cues) as cue_item(cue)
        where cue->>'catalogueItemId' = p_catalogue_item_id::text
      )
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

revoke execute on function private.assert_published_presets_for_catalogue_item(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.validate_catalogue_timing_dependencies()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

revoke execute on function private.validate_catalogue_timing_dependencies()
  from public, anon, authenticated, service_role;

drop trigger if exists catalogue_items_validate_published_timing
  on public.catalogue_items;
create trigger catalogue_items_validate_published_timing
  after update of part_number, duration_seconds, firework_id, multishot_id
  on public.catalogue_items
  for each row execute function private.validate_catalogue_timing_dependencies();

create or replace function private.validate_firework_timing_dependencies()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

revoke execute on function private.validate_firework_timing_dependencies()
  from public, anon, authenticated, service_role;

drop trigger if exists fireworks_validate_published_timing on public.fireworks;
create trigger fireworks_validate_published_timing
  after update of duration_seconds on public.fireworks
  for each row execute function private.validate_firework_timing_dependencies();

-- Linked catalogue rows already cannot be removed. Extend the guard to any
-- unlinked row referenced by a published JSON timeline.
create or replace function public.block_linked_catalogue_item_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
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
