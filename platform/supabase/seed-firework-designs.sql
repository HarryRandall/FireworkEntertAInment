-- Seed renderer fireworks and matching catalogue items.
--
-- Each row stores a FireworkDesign JSON on public.fireworks.render_overrides_json
-- (see platform/lib/fireworks/design.ts). Catalogue rows expose those visuals to
-- show planning.
--
-- Idempotent: re-running this updates existing rows in place.

insert into public.firework_effects (
  slug,
  name,
  description,
  family,
  pattern_key,
  model_json,
  source,
  sort_order
) values
  (
    'renderer-fibonacci',
    'Renderer Fibonacci',
    'Round radial renderer seed pattern.',
    'aerial_burst',
    'fibonacci',
    '{"pattern":"fibonacci"}'::jsonb,
    'manual',
    910
  ),
  (
    'renderer-wave',
    'Renderer Wave',
    'Sinusoidal renderer seed pattern.',
    'aerial_burst',
    'wave',
    '{"pattern":"wave"}'::jsonb,
    'manual',
    920
  ),
  (
    'renderer-strobe',
    'Renderer Strobe',
    'Flickering renderer seed pattern.',
    'aerial_burst',
    'strobe',
    '{"pattern":"strobe"}'::jsonb,
    'manual',
    930
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

with seed_fireworks (
  slug,
  effect_slug,
  name,
  description,
  firework_type,
  duration_seconds,
  shot_count,
  height_meters,
  primary_color,
  color_palette,
  render_overrides_json
) as (
  values
    -- Fibonacci-sphere bursts: round, even radial patterns.
    ('fib-gold', 'renderer-fibonacci', 'Gold Sphere', 'Round gold burst with strobing flair and crackle.',
      'shell', 6.0::numeric, 1, 220::numeric, '#f7c94b', array['gold', 'white']::text[],
      '{"size":220,"pattern":"fibonacci","color":{"r":1.0,"g":0.78,"b":0.21},
        "burst":{"speed":[2,4],"gravity":[-1.6,-0.2],"life":[0.8,5.5],"flairColorMode":"bombColor"},
        "flair":{"enabled":true},
        "crackle":{"enabled":true,"probability":0.06,"sound":"crackle"},
        "sound":{"boom":"auto"},"mortar":{"smokeParticles":120,"sound":true}}'::jsonb),

    ('fib-red', 'renderer-fibonacci', 'Red Sphere', 'Round red burst, classic chrysanthemum feel.',
      'shell', 6.0::numeric, 1, 220::numeric, '#ff0d2e', array['red']::text[],
      '{"size":200,"pattern":"fibonacci","color":{"r":1.0,"g":0.05,"b":0.18},
        "burst":{"speed":[2,3.6],"gravity":[-1.5,-0.2],"life":[0.7,5.0],"flairColorMode":"bombColor"},
        "flair":{"enabled":true},
        "crackle":{"enabled":true,"probability":0.05,"sound":"lightBoom"},
        "sound":{"boom":"auto"},"mortar":{"smokeParticles":110,"sound":true}}'::jsonb),

    ('fib-blue', 'renderer-fibonacci', 'Blue Sphere', 'Cool blue radial burst with light flair.',
      'shell', 5.5::numeric, 1, 200::numeric, '#2e80ff', array['blue', 'white']::text[],
      '{"size":180,"pattern":"fibonacci","color":{"r":0.18,"g":0.5,"b":1.0},
        "burst":{"speed":[2.2,3.8],"gravity":[-1.3,-0.1],"life":[0.6,4.5],"flairColorMode":"mixed"},
        "flair":{"enabled":true},
        "crackle":{"enabled":false,"probability":0,"sound":"crackle"},
        "sound":{"boom":"light"},"mortar":{"smokeParticles":90,"sound":true}}'::jsonb),

    ('fib-green', 'renderer-fibonacci', 'Green Sphere', 'Vivid green chrysanthemum with light glitter trails.',
      'shell', 5.6::numeric, 1, 200::numeric, '#2eff52', array['green', 'gold']::text[],
      '{"size":180,"pattern":"fibonacci","color":{"r":0.18,"g":1.0,"b":0.32},
        "burst":{"speed":[2,3.6],"gravity":[-1.4,-0.2],"life":[0.6,4.6],"flairColorMode":"bombColor"},
        "flair":{"enabled":true},
        "crackle":{"enabled":true,"probability":0.04,"sound":"crackle"},
        "sound":{"boom":"light"},"mortar":{"smokeParticles":95,"sound":true}}'::jsonb),

    ('fib-mega', 'renderer-fibonacci', 'Mega Gold Bloom', 'Huge gold bloom with heavy boom and rich crackle.',
      'shell', 7.5::numeric, 1, 260::numeric, '#f7c94b', array['gold', 'crackle']::text[],
      '{"size":340,"pattern":"fibonacci","color":{"r":1.0,"g":0.78,"b":0.21},
        "burst":{"speed":[2.5,4.5],"gravity":[-2.0,-0.2],"life":[1.0,6.0],"flairColorMode":"bombColor"},
        "flair":{"enabled":true},
        "crackle":{"enabled":true,"probability":0.08,"sound":"heavyBoom"},
        "sound":{"boom":"heavy"},"mortar":{"smokeParticles":160,"sound":true}}'::jsonb),

    -- Wave bursts: sinusoidal stars that swirl while ascending.
    ('wave-rainbow', 'renderer-wave', 'Rainbow Wave', 'Sine-wave burst with mixed flair colours.',
      'shell', 6.5::numeric, 1, 220::numeric, null, array['rainbow', 'mixed']::text[],
      '{"size":220,"pattern":"wave","color":"random",
        "burst":{"speed":[2,4],"gravity":[-1.4,-0.1],"life":[0.7,5.2],"flairColorMode":"mixed"},
        "flair":{"enabled":true},
        "crackle":{"enabled":true,"probability":0.05,"sound":"lightBoom"},
        "sound":{"boom":"auto"},"mortar":{"smokeParticles":110,"sound":true}}'::jsonb),

    ('wave-purple', 'renderer-wave', 'Purple Wave', 'Slow swirling purple stars with crackle ends.',
      'shell', 6.0::numeric, 1, 200::numeric, '#e60aff', array['purple', 'gold']::text[],
      '{"size":180,"pattern":"wave","color":{"r":0.9,"g":0.04,"b":1.0},
        "burst":{"speed":[1.8,3.2],"gravity":[-1.2,-0.1],"life":[0.8,5.0],"flairColorMode":"bombColor"},
        "flair":{"enabled":true},
        "crackle":{"enabled":true,"probability":0.06,"sound":"crackle"},
        "sound":{"boom":"light"},"mortar":{"smokeParticles":95,"sound":true}}'::jsonb),

    ('wave-cyan', 'renderer-wave', 'Cyan Wave', 'Bright cyan stars with sweeping wave trajectories.',
      'shell', 6.0::numeric, 1, 210::numeric, '#2ef2ff', array['cyan', 'white']::text[],
      '{"size":200,"pattern":"wave","color":{"r":0.18,"g":0.95,"b":1.0},
        "burst":{"speed":[2.2,3.8],"gravity":[-1.4,-0.1],"life":[0.7,4.8],"flairColorMode":"mixed"},
        "flair":{"enabled":true},
        "crackle":{"enabled":false,"probability":0,"sound":"crackle"},
        "sound":{"boom":"auto"},"mortar":{"smokeParticles":100,"sound":true}}'::jsonb),

    -- Strobe bursts: flickering size and colour, heavier sound.
    ('strobe-white', 'renderer-strobe', 'White Strobe', 'Heavy strobing white shell with deep boom.',
      'shell', 5.5::numeric, 1, 220::numeric, '#ffffff', array['white']::text[],
      '{"size":260,"pattern":"strobe","color":{"r":1.0,"g":1.0,"b":1.0},
        "burst":{"speed":[2,3.5],"gravity":[-1.6,-0.3],"life":[0.6,5.0],
          "flairSizeStrobe":[10,150],"flairColorMode":"mixed"},
        "flair":{"enabled":true},
        "crackle":{"enabled":true,"probability":0.07,"sound":"heavyBoom"},
        "sound":{"boom":"heavy"},"mortar":{"smokeParticles":140,"sound":true}}'::jsonb),

    ('strobe-red', 'renderer-strobe', 'Red Strobe', 'Aggressive red strobe with pulsing brightness.',
      'shell', 5.2::numeric, 1, 210::numeric, '#ff0d2e', array['red', 'white']::text[],
      '{"size":230,"pattern":"strobe","color":{"r":1.0,"g":0.05,"b":0.18},
        "burst":{"speed":[2,3.4],"gravity":[-1.6,-0.3],"life":[0.5,4.5],
          "flairSizeStrobe":[10,150],"flairColorMode":"bombColor"},
        "flair":{"enabled":true},
        "crackle":{"enabled":true,"probability":0.07,"sound":"heavyBoom"},
        "sound":{"boom":"heavy"},"mortar":{"smokeParticles":130,"sound":true}}'::jsonb),

    ('strobe-mixed', 'renderer-strobe', 'Mixed Strobe', 'Random-colour strobing storm with crackle.',
      'shell', 5.8::numeric, 1, 220::numeric, null, array['mixed', 'white']::text[],
      '{"size":280,"pattern":"strobe","color":"random",
        "burst":{"speed":[2.2,4],"gravity":[-1.8,-0.2],"life":[0.7,5.5],
          "flairSizeStrobe":[10,150],"flairColorMode":"mixed"},
        "flair":{"enabled":true},
        "crackle":{"enabled":true,"probability":0.08,"sound":"heavyBoom"},
        "sound":{"boom":"heavy"},"mortar":{"smokeParticles":140,"sound":true}}'::jsonb),

    ('fib-mini', 'renderer-fibonacci', 'Mini Sphere', 'Small fast bloom for quick volleys.',
      'shell', 3.5::numeric, 1, 140::numeric, null, array['mixed']::text[],
      '{"size":80,"pattern":"fibonacci","color":"random",
        "burst":{"speed":[1.6,3],"gravity":[-1.2,-0.1],"life":[0.4,3.0],"flairColorMode":"random"},
        "flair":{"enabled":true},
        "crackle":{"enabled":false,"probability":0,"sound":"crackle"},
        "sound":{"boom":"light"},"mortar":{"smokeParticles":60,"sound":true}}'::jsonb)
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
    seed.slug,
    seed.name,
    seed.description,
    seed.primary_color,
    seed.color_palette,
    seed.duration_seconds,
    seed.height_meters,
    jsonb_build_object(
      'type', seed.firework_type,
      'shotCount', seed.shot_count,
      'seed', 'firework-designs'
    ),
    seed.render_overrides_json,
    'manual',
    1
  from seed_fireworks seed
  join public.firework_effects effects on effects.slug = seed.effect_slug
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
  seed.slug,
  seed.name,
  'ShowCrafter',
  seed.description,
  'firework',
  fireworks.id,
  null,
  seed.firework_type,
  seed.duration_seconds,
  jsonb_build_object(
    'seed', 'firework-designs',
    'shotCount', seed.shot_count
  )
from seed_fireworks seed
join upserted_fireworks fireworks on fireworks.slug = seed.slug
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
