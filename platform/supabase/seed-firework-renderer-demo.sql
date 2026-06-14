-- Demo seed for the 3D firework renderer.
--
-- Usage:
-- 1. Make sure you have at least one auth user in the local/dev database.
-- 2. Run this file in Supabase SQL editor or with psql after migrations.
-- 3. Open the "Renderer Demo - 5 Second Steps" show.
--
-- The timeline times are exactly 5 seconds apart.

insert into public.firework_effects (
  slug,
  name,
  description,
  family,
  pattern_key,
  model_json,
  source,
  sort_order
) values (
  'renderer-demo',
  'Renderer Demo',
  'Renderer demo visuals for manual preview checks.',
  'aerial_burst',
  'renderer-demo',
  '{}'::jsonb,
  'manual',
  900
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  family = excluded.family,
  pattern_key = excluded.pattern_key,
  model_json = excluded.model_json,
  source = excluded.source,
  sort_order = excluded.sort_order,
  updated_at = now();

with demo_fireworks (
  slug,
  name,
  description,
  firework_type,
  duration_seconds,
  height_meters,
  primary_color,
  color_palette,
  render_overrides_json
) as (
  values
    (
      'demo-opening-comet',
      'Demo Opening Comet',
      'Low gold lift comet with streamer glitter.',
      'comet',
      2.8::numeric,
      42::numeric,
      '#ffbf36',
      array['gold']::text[],
      '{"shellType":"comet","spreadSize":1.8,"starLifeMs":2600,"color":"#ffbf36","glitter":"streamer","glitterColor":"#ffbf36"}'::jsonb
    ),
    (
      'demo-blue-ring',
      'Demo Blue Ring',
      'Medium-height blue ring with a warm pistil.',
      'shell',
      4.0::numeric,
      72::numeric,
      '#1e7fff',
      array['blue', 'gold']::text[],
      '{"shellType":"ring","spreadSize":4.2,"starLifeMs":1450,"color":"#1e7fff","ring":true,"pistil":true,"pistilColor":"#ffbf36","glitter":"light","glitterColor":"#ffffff"}'::jsonb
    ),
    (
      'demo-red-crossette',
      'Demo Red Crossette',
      'Quick red crossette split with medium glitter.',
      'shell',
      3.8::numeric,
      76::numeric,
      '#ff0043',
      array['red', 'gold']::text[],
      '{"shellType":"crossette","spreadSize":3.9,"starLifeMs":1200,"starLifeVariation":0.34,"color":"#ff0043","crossette":true,"glitter":"medium","glitterColor":"#ffbf36","starDensity":0.82}'::jsonb
    ),
    (
      'demo-gold-chrysanthemum',
      'Demo Gold Chrysanthemum',
      'Large round gold bloom with red pistil and light glitter.',
      'shell',
      4.4::numeric,
      82::numeric,
      '#ffbf36',
      array['gold', 'red']::text[],
      '{"shellType":"crysanthemum","spreadSize":4.9,"starLifeMs":1500,"color":"#ffbf36","glitter":"light","glitterColor":"#ffbf36","pistil":true,"pistilColor":"#ff0043","starDensity":1.2}'::jsonb
    ),
    (
      'demo-ghost-blue-green',
      'Demo Ghost Blue-Green',
      'Blue bloom that transitions into green.',
      'shell',
      4.8::numeric,
      84::numeric,
      '#1e7fff',
      array['blue', 'green']::text[],
      '{"shellType":"ghost","spreadSize":4.3,"starLifeMs":1850,"color":"#1e7fff","secondColor":"#14fc56","transitionTimeMs":820,"streamers":true,"glitter":"none"}'::jsonb
    ),
    (
      'demo-purple-crackle',
      'Demo Purple Crackle',
      'Short purple shell with gold crackle after-burst.',
      'shell',
      3.6::numeric,
      76::numeric,
      '#e60aff',
      array['purple', 'gold']::text[],
      '{"shellType":"crackle","spreadSize":4.0,"starLifeMs":1050,"starLifeVariation":0.28,"color":"#e60aff","crackle":true,"glitter":"light","glitterColor":"#ffbf36"}'::jsonb
    ),
    (
      'demo-white-strobe',
      'Demo White Strobe',
      'High white strobe with a longer hang.',
      'shell',
      5.0::numeric,
      92::numeric,
      '#ffffff',
      array['white']::text[],
      '{"shellType":"strobe","spreadSize":4.4,"starLifeMs":1900,"starLifeVariation":0.38,"color":"#ffffff","strobe":true,"strobeColor":"#ffffff","glitter":"none","starDensity":1.0}'::jsonb
    ),
    (
      'demo-falling-leaves',
      'Demo Falling Leaves',
      'Low slow amber falling leaves.',
      'shell',
      6.6::numeric,
      58::numeric,
      '#ffbf36',
      array['amber', 'gold']::text[],
      '{"shellType":"fallingLeaves","spreadSize":3.4,"starLifeMs":3000,"starLifeVariation":0.45,"color":"#ffbf36","fallingLeaves":true,"glitter":"medium","glitterColor":"#ffbf36","starDensity":0.18}'::jsonb
    ),
    (
      'demo-gold-willow',
      'Demo Gold Willow',
      'Long drooping gold willow finale.',
      'shell',
      6.4::numeric,
      76::numeric,
      '#ffbf36',
      array['gold']::text[],
      '{"shellType":"willow","spreadSize":4.2,"starLifeMs":3000,"color":"#ffbf36","glitter":"willow","glitterColor":"#ffbf36","starDensity":0.75}'::jsonb
    )
),
upserted_fireworks as (
  insert into public.fireworks (
    firework_effect_id,
    slug,
    name,
    description,
    primary_color,
    color_palette,
    duration_seconds,
    height_meters,
    variant_json,
    render_overrides_json,
    source,
    confidence
  )
  select
    effects.id,
    demo.slug,
    demo.name,
    demo.description,
    demo.primary_color,
    demo.color_palette,
    demo.duration_seconds,
    demo.height_meters,
    jsonb_build_object('type', demo.firework_type, 'shotCount', 1, 'seed', 'renderer-demo'),
    demo.render_overrides_json,
    'manual',
    1
  from demo_fireworks demo
  join public.firework_effects effects on effects.slug = 'renderer-demo'
  on conflict (slug) do update set
    firework_effect_id = excluded.firework_effect_id,
    name = excluded.name,
    description = excluded.description,
    primary_color = excluded.primary_color,
    color_palette = excluded.color_palette,
    duration_seconds = excluded.duration_seconds,
    height_meters = excluded.height_meters,
    variant_json = excluded.variant_json,
    render_overrides_json = excluded.render_overrides_json,
    source = excluded.source,
    confidence = excluded.confidence,
    updated_at = now()
  returning id, slug
)
insert into public.catalogue_items (
  part_number,
  name,
  manufacturer,
  description,
  catalogue_item_kind,
  firework_id,
  multishot_id,
  firework_type,
  duration_seconds,
  metadata
)
select
  demo.slug,
  demo.name,
  'ShowCrafter',
  demo.description,
  'firework',
  fireworks.id,
  null,
  demo.firework_type,
  demo.duration_seconds,
  jsonb_build_object('seed', 'renderer-demo', 'shotCount', 1)
from demo_fireworks demo
join upserted_fireworks fireworks on fireworks.slug = demo.slug
on conflict (part_number) do update set
  name = excluded.name,
  manufacturer = excluded.manufacturer,
  description = excluded.description,
  catalogue_item_kind = excluded.catalogue_item_kind,
  firework_id = excluded.firework_id,
  multishot_id = null,
  firework_type = excluded.firework_type,
  duration_seconds = excluded.duration_seconds,
  metadata = excluded.metadata,
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

    delete from public.show_timeline_items
    where show_id = demo_show;

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
      demo_show,
      cue.position,
      cue.time_seconds,
      cue.description,
      catalogue.id,
      cue.label,
      'demo',
      cue.layer,
      cue.seed_override,
      1
    from (
      values
        (1, 0.00::numeric, 'Low opening streamer comet', 'demo-opening-comet', 'Opening comet', 'lift', 1101),
        (2, 5.00::numeric, 'Medium blue ring with pistil', 'demo-blue-ring', 'Blue ring', 'rings', 1102),
        (3, 10.00::numeric, 'Fast red crossette split', 'demo-red-crossette', 'Red crossette', 'splits', 1103),
        (4, 15.00::numeric, 'Large gold chrysanthemum bloom', 'demo-gold-chrysanthemum', 'Gold bloom', 'main', 1104),
        (5, 20.00::numeric, 'Blue to green ghost transition', 'demo-ghost-blue-green', 'Ghost transition', 'colour', 1105),
        (6, 25.00::numeric, 'Purple crackle after-burst', 'demo-purple-crackle', 'Purple crackle', 'texture', 1106),
        (7, 30.00::numeric, 'High white strobe', 'demo-white-strobe', 'White strobe', 'strobe', 1107),
        (8, 35.00::numeric, 'Slow amber falling leaves', 'demo-falling-leaves', 'Falling leaves', 'low-hang', 1108),
        (9, 40.00::numeric, 'Long gold willow finish', 'demo-gold-willow', 'Gold willow', 'finale', 1109)
    ) as cue(
      position,
      time_seconds,
      description,
      firework_slug,
      label,
      layer,
      seed_override
    )
    join public.catalogue_items catalogue on catalogue.part_number = cue.firework_slug;
  end loop;
end $$;
