-- Seed renderer fireworks and matching catalogue items.
--
-- Each row stores a FireworkDesign JSON on public.fireworks.render_overrides_json
-- (see platform/lib/fireworks/design.ts). Catalogue rows expose those visuals to
-- show planning.
--
-- Idempotent: re-running this updates existing rows in place.

create or replace function pg_temp.showcrafter_blue_sphere_design()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'colour', jsonb_build_object('enabled', true),
    'size', 180,
    'pattern', 'fibonacci',
    'geometry', 'sphere',
    'trailProfile', 'none',
    'burst', jsonb_build_object(
      'speed', jsonb_build_array(2.2, 3.8),
      'gravity', jsonb_build_array(-1.3, -0.1),
      'life', jsonb_build_array(0.6, 4.5),
      'flairColorMode', 'mixed'
    ),
    'flair', jsonb_build_object('enabled', true),
    'crackle', jsonb_build_object(
      'enabled', false,
      'probability', 0,
      'sound', 'crackle'
    ),
    'sound', jsonb_build_object(
      'launch', true,
      'boom', 'light'
    ),
    'strobe', jsonb_build_object('enabled', false),
    'split', jsonb_build_object('enabled', false),
    'trail', jsonb_build_object(
      'density', 0,
      'length', 0.35,
      'sparkle', 0,
      'thickness', 0.6,
      'streakSize', 1,
      'streakLength', 1,
      'streakLife', 1
    ),
    'burstTrail', jsonb_build_object(
      'enabled', false,
      'preset', 'none',
      'particlesPerStar', 0
    ),
    'mortar', jsonb_build_object(
      'sound', true,
      'smokeParticles', 90
    ),
    'launch', jsonb_build_object(
      'liftParticles', jsonb_build_object(
        'enabled', true,
        'amount', 100,
        'spacing', jsonb_build_object('pathSamples', 5),
        'motion', jsonb_build_object(
          'swirlStrength', 0,
          'swirlRadius', 0,
          'swirlRate', 4
        )
      ),
      'smoke', jsonb_build_object(
        'enabled', true,
        'particles', 90
      )
    ),
    'stars', jsonb_build_object(
      'outer', jsonb_build_object(
        'enabled', true,
        'count', 100,
        'burst', jsonb_build_object(
          'speed', jsonb_build_array(2.2, 3.8),
          'gravity', jsonb_build_array(-1.3, -0.1),
          'life', jsonb_build_array(0.6, 4.5),
          'flairColorMode', 'mixed'
        ),
        'burstTrail', jsonb_build_object(
          'enabled', false,
          'preset', 'none',
          'particlesPerStar', 0
        )
      ),
      'core', jsonb_build_object('enabled', false)
    ),
    'brocade', jsonb_build_object('headsEnabled', false)
  );
$$;

create or replace function pg_temp.showcrafter_blue_sphere_effect_model()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'version', 3,
    'geometry', 'sphere',
    'trailProfile', 'none',
    'renderDefaults', pg_temp.showcrafter_blue_sphere_design()
  );
$$;

create or replace function pg_temp.showcrafter_apply_firework_colour(
  defaults jsonb,
  colour jsonb
)
returns jsonb
language sql
immutable
as $$
  select case
    when colour is null then defaults
    else jsonb_set(
      defaults || jsonb_build_object('color', colour),
      '{stars,outer,color}',
      colour,
      true
    )
  end;
$$;

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
    pg_temp.showcrafter_blue_sphere_effect_model(),
    'manual',
    910
  ),
  (
    'renderer-wave',
    'Renderer Wave',
    'Sinusoidal renderer seed pattern.',
    'aerial_burst',
    'fibonacci',
    pg_temp.showcrafter_blue_sphere_effect_model(),
    'manual',
    920
  ),
  (
    'renderer-strobe',
    'Renderer Strobe',
    'Flickering renderer seed pattern.',
    'aerial_burst',
    'fibonacci',
    pg_temp.showcrafter_blue_sphere_effect_model(),
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
  renderer_colour_json
) as (
  values
    -- Fibonacci-sphere bursts: round, even radial patterns.
    ('fib-gold', 'renderer-fibonacci', 'Gold Sphere', 'Round gold burst with strobing flair and crackle.',
      'shell', 6.0::numeric, 1, 220::numeric, '#f7c94b', array['gold', 'white']::text[],
      '{"r":1.0,"g":0.78,"b":0.21}'::jsonb),

    ('fib-red', 'renderer-fibonacci', 'Red Sphere', 'Round red burst, classic chrysanthemum feel.',
      'shell', 6.0::numeric, 1, 220::numeric, '#ff0d2e', array['red']::text[],
      '{"r":1.0,"g":0.05,"b":0.18}'::jsonb),

    ('fib-blue', 'renderer-fibonacci', 'Blue Sphere', 'Cool blue radial burst with light flair.',
      'shell', 5.5::numeric, 1, 200::numeric, '#2e80ff', array['blue', 'white']::text[],
      '{"r":0.18,"g":0.5,"b":1.0}'::jsonb),

    ('fib-green', 'renderer-fibonacci', 'Green Sphere', 'Vivid green chrysanthemum with light glitter trails.',
      'shell', 5.6::numeric, 1, 200::numeric, '#2eff52', array['green', 'gold']::text[],
      '{"r":0.18,"g":1.0,"b":0.32}'::jsonb),

    ('fib-mega', 'renderer-fibonacci', 'Mega Gold Bloom', 'Huge gold bloom with heavy boom and rich crackle.',
      'shell', 7.5::numeric, 1, 260::numeric, '#f7c94b', array['gold', 'crackle']::text[],
      '{"r":1.0,"g":0.78,"b":0.21}'::jsonb),

    -- Wave bursts: sinusoidal stars that swirl while ascending.
    ('wave-rainbow', 'renderer-wave', 'Rainbow Wave', 'Sine-wave burst with mixed flair colours.',
      'shell', 6.5::numeric, 1, 220::numeric, null, array['rainbow', 'mixed']::text[],
      '"random"'::jsonb),

    ('wave-purple', 'renderer-wave', 'Purple Wave', 'Slow swirling purple stars with crackle ends.',
      'shell', 6.0::numeric, 1, 200::numeric, '#e60aff', array['purple', 'gold']::text[],
      '{"r":0.9,"g":0.04,"b":1.0}'::jsonb),

    ('wave-cyan', 'renderer-wave', 'Cyan Wave', 'Bright cyan stars with sweeping wave trajectories.',
      'shell', 6.0::numeric, 1, 210::numeric, '#2ef2ff', array['cyan', 'white']::text[],
      '{"r":0.18,"g":0.95,"b":1.0}'::jsonb),

    -- Strobe bursts: flickering size and colour, heavier sound.
    ('strobe-white', 'renderer-strobe', 'White Strobe', 'Heavy strobing white shell with deep boom.',
      'shell', 5.5::numeric, 1, 220::numeric, '#ffffff', array['white']::text[],
      '{"r":1.0,"g":1.0,"b":1.0}'::jsonb),

    ('strobe-red', 'renderer-strobe', 'Red Strobe', 'Aggressive red strobe with pulsing brightness.',
      'shell', 5.2::numeric, 1, 210::numeric, '#ff0d2e', array['red', 'white']::text[],
      '{"r":1.0,"g":0.05,"b":0.18}'::jsonb),

    ('strobe-mixed', 'renderer-strobe', 'Mixed Strobe', 'Random-colour strobing storm with crackle.',
      'shell', 5.8::numeric, 1, 220::numeric, null, array['mixed', 'white']::text[],
      '"random"'::jsonb),

    ('fib-mini', 'renderer-fibonacci', 'Mini Sphere', 'Small fast bloom for quick volleys.',
      'shell', 3.5::numeric, 1, 140::numeric, null, array['mixed']::text[],
      '"random"'::jsonb)
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
    pg_temp.showcrafter_apply_firework_colour(
      pg_temp.showcrafter_blue_sphere_design(),
      seed.renderer_colour_json
    ),
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
