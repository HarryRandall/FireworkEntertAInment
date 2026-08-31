begin;

insert into public.firework_effects (
  id,
  slug,
  name,
  pattern_key
)
values (
  '91000000-0000-4000-8000-000000000000'::uuid,
  'test-preset-safety-effect',
  'Test preset safety effect',
  'sphere'
);

insert into public.fireworks (
  id,
  firework_effect_id,
  slug,
  name,
  duration_seconds
)
values (
  '91000000-0000-4000-8000-000000000001'::uuid,
  '91000000-0000-4000-8000-000000000000'::uuid,
  'test-preset-multishot-child',
  'Test preset multishot child',
  4
);

insert into public.fireworks (
  id,
  firework_effect_id,
  slug,
  name,
  duration_seconds
)
values (
  '91000000-0000-4000-8000-000000000002'::uuid,
  '91000000-0000-4000-8000-000000000000'::uuid,
  'test-preset-direct-cue',
  'Test preset direct cue',
  1
);

insert into public.multishots (
  id,
  slug,
  name,
  duration_seconds
)
values (
  '91000000-0000-4000-8000-000000000003'::uuid,
  'test-preset-multishot',
  'Test preset multishot',
  4
);

insert into public.multishot_fireworks (
  id,
  multishot_id,
  firework_id,
  sequence_index,
  time_offset_seconds,
  position_override_json
)
values (
  '91000000-0000-4000-8000-000000000004'::uuid,
  '91000000-0000-4000-8000-000000000003'::uuid,
  '91000000-0000-4000-8000-000000000001'::uuid,
  1,
  0,
  '{"launchPositionIndex": 2}'::jsonb
);

create function pg_temp.show_preset_test_cues(
  p_direct_time numeric,
  p_direct_launch_position integer
)
returns jsonb
language sql
stable
as $$
  select jsonb_build_array(
    jsonb_build_object(
      'catalogueItemId', multishot_item.id,
      'catalogueItemSlug', multishot_item.part_number,
      'timeSeconds', 0,
      'description', 'Test preset multishot',
      'launchPositionIndex', 0,
      'emphasis', 'normal'
    ),
    jsonb_build_object(
      'catalogueItemId', direct_item.id,
      'catalogueItemSlug', direct_item.part_number,
      'timeSeconds', p_direct_time,
      'description', 'Test preset direct cue',
      'launchPositionIndex', p_direct_launch_position,
      'emphasis', 'normal'
    )
  )
  from public.catalogue_items multishot_item
  cross join public.catalogue_items direct_item
  where multishot_item.multishot_id = '91000000-0000-4000-8000-000000000003'::uuid
    and direct_item.firework_id = '91000000-0000-4000-8000-000000000002'::uuid;
$$;

do $$
declare
  rejected boolean := false;
  failure_message text;
begin
  begin
    insert into public.show_presets (
      slug,
      title,
      theme,
      duration_seconds,
      preview_cues,
      is_published,
      published_at
    )
    values (
      'test-preset-child-conflict',
      'Test preset child conflict',
      'Test',
      10,
      pg_temp.show_preset_test_cues(2, 2),
      true,
      now()
    );
  exception
    when check_violation then
      rejected := true;
      failure_message := sqlerrm;
  end;

  if not rejected
    or failure_message not like '%overlaps occupied launch position 2%'
  then
    raise exception 'A published preset ignored an absolute multishot child-position conflict.';
  end if;
end;
$$;

-- Half-open intervals keep the exact product boundary available.
insert into public.show_presets (
  id,
  slug,
  title,
  theme,
  duration_seconds,
  preview_cues,
  is_published,
  published_at
)
values (
  '91000000-0000-4000-8000-000000000005'::uuid,
  'test-preset-exact-boundary',
  'Test preset exact boundary',
  'Test',
  10,
  pg_temp.show_preset_test_cues(4, 2),
  true,
  now()
);

-- A position outside the parent and child occupied set remains independent.
insert into public.show_presets (
  id,
  slug,
  title,
  theme,
  duration_seconds,
  preview_cues,
  is_published,
  published_at
)
values (
  '91000000-0000-4000-8000-000000000006'::uuid,
  'test-preset-independent-position',
  'Test preset independent position',
  'Test',
  10,
  pg_temp.show_preset_test_cues(2, 1),
  true,
  now()
);

do $$
declare
  rejected boolean := false;
begin
  begin
    update public.multishot_fireworks
    set position_override_json = '{"launchPositionIndex": 1}'::jsonb
    where id = '91000000-0000-4000-8000-000000000004'::uuid;
  exception
    when check_violation then
      rejected := true;
  end;

  if not rejected or (
    select position_override_json ->> 'launchPositionIndex'
    from public.multishot_fireworks
    where id = '91000000-0000-4000-8000-000000000004'::uuid
  ) <> '2' then
    raise exception 'A multishot child-position edit invalidated a published preset.';
  end if;
end;
$$;

do $$
declare
  rejected boolean := false;
  original_part_number text;
begin
  select part_number
  into original_part_number
  from public.catalogue_items
  where firework_id = '91000000-0000-4000-8000-000000000002'::uuid;

  begin
    update public.catalogue_items
    set part_number = 'test-preset-stale-part-number'
    where firework_id = '91000000-0000-4000-8000-000000000002'::uuid;
  exception
    when foreign_key_violation then
      rejected := true;
  end;

  if not rejected or (
    select part_number
    from public.catalogue_items
    where firework_id = '91000000-0000-4000-8000-000000000002'::uuid
  ) <> original_part_number then
    raise exception 'A catalogue edit invalidated a published preset.';
  end if;
end;
$$;

do $$
declare
  rejected boolean := false;
begin
  begin
    update public.fireworks
    set duration_seconds = 9
    where id = '91000000-0000-4000-8000-000000000002'::uuid;
  exception
    when check_violation then
      rejected := true;
  end;

  if not rejected or (
    select duration_seconds
    from public.fireworks
    where id = '91000000-0000-4000-8000-000000000002'::uuid
  ) <> 1 then
    raise exception 'A firework timing edit invalidated a published preset.';
  end if;
end;
$$;

rollback;
