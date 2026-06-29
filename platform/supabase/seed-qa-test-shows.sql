-- Idempotent renderer QA test shows for every auth user.
--
-- Run after migrations have seeded the current firework catalogue.
-- These shows are overwritten on each run so the timeline timings stay stable.

do $$
declare
  demo_user record;
  pattern_show uuid;
  colour_show uuid;
  replay_show uuid;
  missing_slugs text[];
begin
  select array_agg(required.slug order by required.slug)
  into missing_slugs
  from (
    values
      ('peony-azure'),
      ('peony-default'),
      ('saturn-default'),
      ('brocade-default'),
      ('mine-default'),
      ('peony-crimson'),
      ('strobe-azure'),
      ('strobe-crimson'),
      ('strobe-default'),
      ('whirl-azure'),
      ('whirl-crimson'),
      ('whirl-default')
  ) as required(slug)
  left join public.catalogue_items catalogue
    on catalogue.part_number = required.slug
   and catalogue.catalogue_item_kind = 'firework'
  where catalogue.id is null;

  if missing_slugs is not null then
    raise exception 'Missing firework catalogue_items: %. Run the firework catalogue migrations first.', missing_slugs;
  end if;

  if not exists (select 1 from auth.users) then
    raise exception 'No auth user found. Create/sign in a user before running seed-qa-test-shows.sql.';
  end if;

  for demo_user in
    select id, email, raw_user_meta_data
    from auth.users
    order by created_at
  loop
    insert into public.users (id, email, full_name)
    values (
      demo_user.id,
      demo_user.email,
      coalesce(demo_user.raw_user_meta_data->>'full_name', 'Demo User')
    )
    on conflict (id) do update set
      email = excluded.email,
      full_name = excluded.full_name,
      updated_at = now();

    insert into public.shows (
      user_id,
      slug,
      title,
      song,
      artist,
      status,
      duration_seconds,
      budget_cents,
      total_cents,
      effects_count,
      sync_percent,
      safety_meters,
      time_of_day,
      location,
      description,
      mood_tags,
      launch_positions_json
    )
    values (
      demo_user.id,
      'qa-pattern-check',
      'QA Pattern Check',
      'Pattern Check',
      'ShowCrafter',
      'draft',
      24,
      0,
      0,
      6,
      100,
      35,
      'Night',
      'Renderer test grid',
      'Peony, whirl, and strobe cues across left, centre, and right mortars.',
      array['QA', 'Pattern check', 'Renderer test'],
      '[{"x":-220,"y":0,"z":0},{"x":0,"y":0,"z":0},{"x":220,"y":0,"z":0}]'::jsonb
    )
    on conflict (user_id, slug) do update
    set
      title = excluded.title,
      song = excluded.song,
      artist = excluded.artist,
      duration_seconds = excluded.duration_seconds,
      budget_cents = excluded.budget_cents,
      total_cents = excluded.total_cents,
      effects_count = excluded.effects_count,
      sync_percent = excluded.sync_percent,
      safety_meters = excluded.safety_meters,
      time_of_day = excluded.time_of_day,
      location = excluded.location,
      description = excluded.description,
      mood_tags = excluded.mood_tags,
      launch_positions_json = excluded.launch_positions_json,
      updated_at = now()
    returning id into pattern_show;

    delete from public.show_timeline_items where show_id = pattern_show;

    insert into public.show_timeline_items (
      show_id,
      position,
      time_seconds,
      description,
      catalogue_item_id,
      label,
      track,
      layer,
      seed_override,
      launch_position_index
    )
    select
      pattern_show,
      cue.position,
      cue.time_seconds,
      cue.description,
      catalogue.id,
      cue.label,
      'qa-pattern',
      cue.layer,
      cue.seed_override,
      cue.launch_position_index
    from (
      values
        (1, 0.50::numeric, 'Left mortar gold peony', 'peony-default', 'Gold peony', 'peony', 2101, 0),
        (2, 3.50::numeric, 'Centre mortar crimson whirl', 'whirl-crimson', 'Crimson whirl', 'whirl', 2102, 1),
        (3, 6.50::numeric, 'Right mortar white strobe', 'strobe-default', 'Strobe white', 'strobe', 2103, 2),
        (4, 9.50::numeric, 'Left mortar azure peony', 'peony-azure', 'Azure peony', 'peony', 2104, 0),
        (5, 12.50::numeric, 'Centre mortar azure whirl', 'whirl-azure', 'Azure whirl', 'whirl', 2105, 1),
        (6, 15.50::numeric, 'Right mortar red strobe', 'strobe-crimson', 'Strobe red', 'strobe', 2106, 2)
    ) as cue(position, time_seconds, description, firework_slug, label, layer, seed_override, launch_position_index)
    join public.catalogue_items catalogue on catalogue.part_number = cue.firework_slug;

    insert into public.shows (
      user_id,
      slug,
      title,
      song,
      artist,
      status,
      duration_seconds,
      budget_cents,
      total_cents,
      effects_count,
      sync_percent,
      safety_meters,
      time_of_day,
      location,
      description,
      mood_tags,
      launch_positions_json
    )
    values (
      demo_user.id,
      'qa-colour-check',
      'QA Colour Check',
      'Colour Check',
      'ShowCrafter',
      'draft',
      28,
      0,
      0,
      6,
      100,
      35,
      'Night',
      'Renderer test grid',
      'Colour-focused QA cues for confirming shells, trails, bursts, and crackle are not stuck red.',
      array['QA', 'Colour check', 'Renderer test'],
      '[{"x":-220,"y":0,"z":0},{"x":0,"y":0,"z":0},{"x":220,"y":0,"z":0}]'::jsonb
    )
    on conflict (user_id, slug) do update
    set
      title = excluded.title,
      song = excluded.song,
      artist = excluded.artist,
      duration_seconds = excluded.duration_seconds,
      budget_cents = excluded.budget_cents,
      total_cents = excluded.total_cents,
      effects_count = excluded.effects_count,
      sync_percent = excluded.sync_percent,
      safety_meters = excluded.safety_meters,
      time_of_day = excluded.time_of_day,
      location = excluded.location,
      description = excluded.description,
      mood_tags = excluded.mood_tags,
      launch_positions_json = excluded.launch_positions_json,
      updated_at = now()
    returning id into colour_show;

    delete from public.show_timeline_items where show_id = colour_show;

    insert into public.show_timeline_items (
      show_id,
      position,
      time_seconds,
      description,
      catalogue_item_id,
      label,
      track,
      layer,
      seed_override,
      launch_position_index
    )
    select
      colour_show,
      cue.position,
      cue.time_seconds,
      cue.description,
      catalogue.id,
      cue.label,
      'qa-colour',
      cue.layer,
      cue.seed_override,
      cue.launch_position_index
    from (
      values
        (1, 0.50::numeric, 'Red sphere from left mortar', 'peony-crimson', 'Red sphere', 'red', 2201, 0),
        (2, 3.50::numeric, 'Saturn ring from centre mortar', 'saturn-default', 'Saturn ring', 'ring', 2202, 1),
        (3, 6.50::numeric, 'Azure peony from right mortar', 'peony-azure', 'Azure peony', 'blue', 2203, 2),
        (4, 9.50::numeric, 'Whirl from left mortar', 'whirl-default', 'Whirl', 'whirl', 2204, 0),
        (5, 12.50::numeric, 'Mixed strobe from centre mortar', 'strobe-azure', 'Mixed strobe', 'mixed', 2205, 1),
        (6, 15.50::numeric, 'Mega gold bloom from right mortar', 'brocade-default', 'Mega gold', 'gold', 2206, 2)
    ) as cue(position, time_seconds, description, firework_slug, label, layer, seed_override, launch_position_index)
    join public.catalogue_items catalogue on catalogue.part_number = cue.firework_slug;

    insert into public.shows (
      user_id,
      slug,
      title,
      song,
      artist,
      status,
      duration_seconds,
      budget_cents,
      total_cents,
      effects_count,
      sync_percent,
      safety_meters,
      time_of_day,
      location,
      description,
      mood_tags,
      launch_positions_json
    )
    values (
      demo_user.id,
      'qa-replay-scrub-check',
      'QA Replay Scrub Check',
      'Replay Check',
      'ShowCrafter',
      'draft',
      18,
      0,
      0,
      5,
      100,
      35,
      'Night',
      'Renderer test grid',
      'Short cue sequence for replaying and scrubbing backward without sound spam.',
      array['QA', 'Replay check', 'Renderer test'],
      '[{"x":-220,"y":0,"z":0},{"x":0,"y":0,"z":0},{"x":220,"y":0,"z":0}]'::jsonb
    )
    on conflict (user_id, slug) do update
    set
      title = excluded.title,
      song = excluded.song,
      artist = excluded.artist,
      duration_seconds = excluded.duration_seconds,
      budget_cents = excluded.budget_cents,
      total_cents = excluded.total_cents,
      effects_count = excluded.effects_count,
      sync_percent = excluded.sync_percent,
      safety_meters = excluded.safety_meters,
      time_of_day = excluded.time_of_day,
      location = excluded.location,
      description = excluded.description,
      mood_tags = excluded.mood_tags,
      launch_positions_json = excluded.launch_positions_json,
      updated_at = now()
    returning id into replay_show;

    delete from public.show_timeline_items where show_id = replay_show;

    insert into public.show_timeline_items (
      show_id,
      position,
      time_seconds,
      description,
      catalogue_item_id,
      label,
      track,
      layer,
      seed_override,
      launch_position_index
    )
    select
      replay_show,
      cue.position,
      cue.time_seconds,
      cue.description,
      catalogue.id,
      cue.label,
      'qa-replay',
      cue.layer,
      cue.seed_override,
      cue.launch_position_index
    from (
      values
        (1, 0.75::numeric, 'Small fast bloom from left mortar', 'mine-default', 'Mini sphere', 'quick', 2301, 0),
        (2, 2.75::numeric, 'Azure whirl from centre mortar', 'whirl-azure', 'Azure whirl', 'whirl', 2302, 1),
        (3, 4.75::numeric, 'White strobe from right mortar', 'strobe-default', 'White strobe', 'strobe', 2303, 2),
        (4, 7.25::numeric, 'Gold sphere from centre mortar', 'peony-default', 'Gold sphere', 'replay', 2304, 1),
        (5, 10.00::numeric, 'Mega gold bloom from left mortar', 'brocade-default', 'Mega gold', 'finale', 2305, 0)
    ) as cue(position, time_seconds, description, firework_slug, label, layer, seed_override, launch_position_index)
    join public.catalogue_items catalogue on catalogue.part_number = cue.firework_slug;
  end loop;
end $$;
