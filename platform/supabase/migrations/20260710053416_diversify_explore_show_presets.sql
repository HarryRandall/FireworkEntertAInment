-- The generated Explore collections previously reused one fixed eight-product
-- pool per collection. Give every generated preset its own deterministic
-- catalogue mix, then reschedule the changed products against the three launch
-- positions so every published timeline remains safe to clone.
do $$
declare
  preset_row record;
  cue_row record;
  selected_item record;
  linked_catalogue_item_count integer;
  products_per_show constant integer := 8;
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
  select count(*)
  into linked_catalogue_item_count
  from public.catalogue_items item
  where item.firework_id is not null
     or item.multishot_id is not null;

  if linked_catalogue_item_count < products_per_show then
    raise exception 'Explore preset diversification requires at least % linked catalogue items.',
      products_per_show;
  end if;

  for preset_row in
    select preset.id, preset.preview_cues, preset.duration_seconds
    from public.show_presets preset
    where preset.slug ~ '^library-(featured|popular|hot|recent|shortest)-[0-9]{2}-'
    order by preset.slug
  loop
    busy_until := array[0::numeric, 0::numeric, 0::numeric];
    rebuilt_cues := '[]'::jsonb;
    latest_end := 0;

    for cue_row in
      select cue, cue_index
      from jsonb_array_elements(preset_row.preview_cues)
        with ordinality as cue_item(cue, cue_index)
      order by cue_index
    loop
      select
        item.id,
        item.part_number,
        item.name,
        private.catalogue_item_safe_duration(item.id) as duration_seconds
      into strict selected_item
      from public.catalogue_items item
      where item.firework_id is not null
         or item.multishot_id is not null
      order by md5(preset_row.id::text || ':' || item.id::text), item.id
      offset ((cue_row.cue_index - 1) % products_per_show)
      limit 1;

      product_duration := selected_item.duration_seconds;
      original_time := greatest(0, (cue_row.cue->>'timeSeconds')::numeric);
      desired_lane := greatest(
        0,
        least(
          2,
          coalesce((cue_row.cue->>'launchPositionIndex')::integer, 0)
        )
      );
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
        (cue_row.cue
          - 'timeSeconds'
          - 'catalogueItemId'
          - 'catalogueItemSlug'
          - 'fireworkSlug'
          - 'description'
          - 'launchPositionIndex'
          - 'emphasis')
        || jsonb_build_object(
          'timeSeconds', round(scheduled_time, 2),
          'catalogueItemId', selected_item.id,
          'catalogueItemSlug', selected_item.part_number,
          'description', selected_item.name,
          'launchPositionIndex', scheduled_lane,
          'emphasis', coalesce(cue_row.cue->>'emphasis', 'normal')
        )
      );
    end loop;

    update public.show_presets preset
    set preview_cues = rebuilt_cues,
        duration_seconds = greatest(preset_row.duration_seconds, ceil(latest_end)::integer)
    where preset.id = preset_row.id;
  end loop;
end;
$$;

-- Fail the migration instead of leaving visually duplicated generated shows
-- if a future catalogue is too small or unusually hash-collides.
do $$
begin
  if exists (
    select signature
    from (
      select
        preset.id,
        string_agg(
          distinct cue->>'catalogueItemId',
          '|' order by cue->>'catalogueItemId'
        ) as signature
      from public.show_presets preset
      cross join lateral jsonb_array_elements(preset.preview_cues) as cue_item(cue)
      where preset.slug ~ '^library-(featured|popular|hot|recent|shortest)-[0-9]{2}-'
      group by preset.id
    ) diversified
    group by signature
    having count(*) > 1
  ) then
    raise exception 'Generated Explore presets still contain duplicate firework compositions.';
  end if;
end;
$$;
