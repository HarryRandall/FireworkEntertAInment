-- Demo seed for the 3D firework renderer.
--
-- Usage:
-- 1. Make sure you have at least one auth user in the local/dev database.
-- 2. Run this file in Supabase SQL editor or with psql after migrations.
-- 3. Open the "Renderer Demo - 5 Second Steps" show.
--
-- The cue times are exactly 5 seconds apart.

insert into public.effect_specs (
  slug,
  name,
  description,
  type,
  duration_seconds,
  shot_count,
  height_meters,
  source,
  confidence,
  spec_json
)
values
  (
    'demo-opening-comet',
    'Demo Opening Comet',
    'Low gold lift comet with streamer glitter.',
    'comet',
    2.8,
    1,
    42,
    'manual',
    1,
    '{"shellType":"comet","spreadSize":1.8,"starLifeMs":2600,"color":"#ffbf36","glitter":"streamer","glitterColor":"#ffbf36"}'::jsonb
  ),
  (
    'demo-blue-ring',
    'Demo Blue Ring',
    'Medium-height blue ring with a warm pistil.',
    'shell',
    4.0,
    1,
    72,
    'manual',
    1,
    '{"shellType":"ring","spreadSize":4.2,"starLifeMs":1450,"color":"#1e7fff","ring":true,"pistil":true,"pistilColor":"#ffbf36","glitter":"light","glitterColor":"#ffffff"}'::jsonb
  ),
  (
    'demo-red-crossette',
    'Demo Red Crossette',
    'Quick red crossette split with medium glitter.',
    'shell',
    3.8,
    1,
    76,
    'manual',
    1,
    '{"shellType":"crossette","spreadSize":3.9,"starLifeMs":1200,"starLifeVariation":0.34,"color":"#ff0043","crossette":true,"glitter":"medium","glitterColor":"#ffbf36","starDensity":0.82}'::jsonb
  ),
  (
    'demo-gold-chrysanthemum',
    'Demo Gold Chrysanthemum',
    'Large round gold bloom with red pistil and light glitter.',
    'shell',
    4.4,
    1,
    82,
    'manual',
    1,
    '{"shellType":"crysanthemum","spreadSize":4.9,"starLifeMs":1500,"color":"#ffbf36","glitter":"light","glitterColor":"#ffbf36","pistil":true,"pistilColor":"#ff0043","starDensity":1.2}'::jsonb
  ),
  (
    'demo-ghost-blue-green',
    'Demo Ghost Blue-Green',
    'Blue bloom that transitions into green.',
    'shell',
    4.8,
    1,
    84,
    'manual',
    1,
    '{"shellType":"ghost","spreadSize":4.3,"starLifeMs":1850,"color":"#1e7fff","secondColor":"#14fc56","transitionTimeMs":820,"streamers":true,"glitter":"none"}'::jsonb
  ),
  (
    'demo-purple-crackle',
    'Demo Purple Crackle',
    'Short purple shell with gold crackle after-burst.',
    'shell',
    3.6,
    1,
    76,
    'manual',
    1,
    '{"shellType":"crackle","spreadSize":4.0,"starLifeMs":1050,"starLifeVariation":0.28,"color":"#e60aff","crackle":true,"glitter":"light","glitterColor":"#ffbf36"}'::jsonb
  ),
  (
    'demo-white-strobe',
    'Demo White Strobe',
    'High white strobe with a longer hang.',
    'shell',
    5.0,
    1,
    92,
    'manual',
    1,
    '{"shellType":"strobe","spreadSize":4.4,"starLifeMs":1900,"starLifeVariation":0.38,"color":"#ffffff","strobe":true,"strobeColor":"#ffffff","glitter":"none","starDensity":1.0}'::jsonb
  ),
  (
    'demo-falling-leaves',
    'Demo Falling Leaves',
    'Low slow amber falling leaves.',
    'shell',
    6.6,
    1,
    58,
    'manual',
    1,
    '{"shellType":"fallingLeaves","spreadSize":3.4,"starLifeMs":3000,"starLifeVariation":0.45,"color":"#ffbf36","fallingLeaves":true,"glitter":"medium","glitterColor":"#ffbf36","starDensity":0.18}'::jsonb
  ),
  (
    'demo-gold-willow',
    'Demo Gold Willow',
    'Long drooping gold willow finale.',
    'shell',
    6.4,
    1,
    76,
    'manual',
    1,
    '{"shellType":"willow","spreadSize":4.2,"starLifeMs":3000,"color":"#ffbf36","glitter":"willow","glitterColor":"#ffbf36","starDensity":0.75}'::jsonb
  )
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  type = excluded.type,
  duration_seconds = excluded.duration_seconds,
  shot_count = excluded.shot_count,
  height_meters = excluded.height_meters,
  source = excluded.source,
  confidence = excluded.confidence,
  spec_json = excluded.spec_json,
  updated_at = now();

do $$
declare
  demo_user record;
  demo_show uuid;
begin
  if not exists (select 1 from auth.users) then
    raise exception 'No auth user found. Create/sign in a user before running seed-firework-renderer-demo.sql.';
  end if;

  for demo_user in
    select id, email, raw_user_meta_data
    from auth.users
    order by created_at
  loop
    insert into public.profiles (id, email, full_name)
    values (
      demo_user.id,
      demo_user.email,
      coalesce(demo_user.raw_user_meta_data->>'full_name', 'Demo User')
    )
    on conflict (id) do nothing;

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
      mood_tags
    )
    values (
      demo_user.id,
      'firework-renderer-demo',
      'Renderer Demo - 5 Second Steps',
      'Renderer Demo',
      'ShowCrafter',
      'draft',
      48,
      125000,
      125000,
      9,
      100,
      35,
      'Night',
      'Central test grid',
      'Nine renderer demo cues, each spaced exactly five seconds apart.',
      array['Renderer demo', '5 second spacing', '3D preview']
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
      updated_at = now()
    returning id into demo_show;

    delete from public.show_cues
    where show_id = demo_show;

    insert into public.show_cues (
      show_id,
      position,
      time_seconds,
      description,
      effect_spec_id,
      position_json,
      rotation_json,
      scale,
      label,
      track,
      layer,
      seed_override
    )
    select
      demo_show,
      cue.position,
      cue.time_seconds,
      cue.description,
      effect_specs.id,
      jsonb_build_object('x', 0, 'y', cue.height_offset, 'z', 0),
      jsonb_build_object('pan', 0, 'tilt', 90, 'roll', cue.roll_degrees),
      cue.scale,
      cue.label,
      'demo',
      cue.layer,
      cue.seed_override
    from (
      values
        (1, 0.00::numeric, 'Low opening streamer comet', 'demo-opening-comet', 0.00::numeric, 1.00::numeric, 0, 'Opening comet', 'lift', 1101),
        (2, 5.00::numeric, 'Medium blue ring with pistil', 'demo-blue-ring', 0.10::numeric, 1.00::numeric, 18, 'Blue ring', 'rings', 1102),
        (3, 10.00::numeric, 'Fast red crossette split', 'demo-red-crossette', 0.20::numeric, 1.00::numeric, -8, 'Red crossette', 'splits', 1103),
        (4, 15.00::numeric, 'Large gold chrysanthemum bloom', 'demo-gold-chrysanthemum', 0.35::numeric, 1.00::numeric, 0, 'Gold bloom', 'main', 1104),
        (5, 20.00::numeric, 'Blue to green ghost transition', 'demo-ghost-blue-green', 0.45::numeric, 1.00::numeric, 0, 'Ghost transition', 'colour', 1105),
        (6, 25.00::numeric, 'Purple crackle after-burst', 'demo-purple-crackle', 0.15::numeric, 1.00::numeric, 0, 'Purple crackle', 'texture', 1106),
        (7, 30.00::numeric, 'High white strobe', 'demo-white-strobe', 0.55::numeric, 1.00::numeric, 0, 'White strobe', 'strobe', 1107),
        (8, 35.00::numeric, 'Slow amber falling leaves', 'demo-falling-leaves', -0.10::numeric, 0.90::numeric, 0, 'Falling leaves', 'low-hang', 1108),
        (9, 40.00::numeric, 'Long gold willow finish', 'demo-gold-willow', 0.20::numeric, 1.02::numeric, 0, 'Gold willow', 'finale', 1109)
    ) as cue(
      position,
      time_seconds,
      description,
      effect_slug,
      height_offset,
      scale,
      roll_degrees,
      label,
      layer,
      seed_override
    )
    join public.effect_specs on effect_specs.slug = cue.effect_slug;
  end loop;
end $$;
