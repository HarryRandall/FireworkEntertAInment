-- Paste this into Supabase SQL editor to seed standalone CodePen-style fireworks.
-- Each row is one reusable firework. Shows compose them by adding multiple show_cues
-- with different time_seconds, position_json, rotation_json, scale, and effect_spec_id.

with codepen_effects(slug, name, description, type, family, duration_seconds, height_meters, size, colors, glitter, pistil, streamers, strobe, crackle, smoke_amount) as (
  values
    ('codepen-red-chrysanthemum', 'CodePen Red Chrysanthemum', 'Dense red chrysanthemum with light glitter and an optional gold pistil.', 'shell', 'chrysanthemum', 4.8, 88, 3.0, array['#ff0043', '#ffbf36'], 'light', true, false, false, false, 0.28),
    ('codepen-green-ghost', 'CodePen Green Ghost', 'Invisible-to-green ghost shell with streamer trails.', 'shell', 'ghost', 5.4, 86, 3.0, array['#14fc56', '#ffffff'], 'none', true, true, false, false, 0.24),
    ('codepen-white-strobe', 'CodePen White Strobe', 'White strobe shell with crisp on-off stars.', 'shell', 'strobe', 4.8, 84, 2.8, array['#ffffff', '#1e7fff'], 'light', true, false, true, false, 0.22),
    ('codepen-gold-palm', 'CodePen Gold Palm', 'Chunky gold palm fronds with heavy glitter tails.', 'shell', 'palm', 5.0, 86, 3.0, array['#ffbf36', '#ffffff'], 'heavy', false, false, false, false, 0.3),
    ('codepen-blue-ring', 'CodePen Blue Ring', 'Clean blue ring with a small white pistil.', 'shell', 'ring', 4.4, 82, 2.7, array['#1e7fff', '#ffffff'], 'light', true, false, false, false, 0.2),
    ('codepen-purple-crossette', 'CodePen Purple Crossette', 'Purple stars splitting into cross-like child sparks.', 'shell', 'crossette', 4.6, 86, 2.8, array['#e60aff', '#ffffff'], 'none', true, false, false, false, 0.24),
    ('codepen-floral-mixed', 'CodePen Mixed Floral', 'Sparse floral shell with red, blue, green, and gold mini-bursts.', 'shell', 'floral', 4.2, 78, 2.5, array['#ff0043', '#1e7fff', '#14fc56', '#ffbf36'], 'none', false, false, false, false, 0.18),
    ('codepen-falling-leaves', 'CodePen Falling Leaves', 'Slow gold falling leaves with drifting ember tails.', 'shell', 'falling_leaves', 6.0, 76, 3.1, array['#ffbf36', '#ffffff'], 'medium', false, false, false, false, 0.32),
    ('codepen-gold-willow', 'CodePen Gold Willow', 'Long hanging gold willow curtain.', 'shell', 'willow', 6.3, 90, 3.2, array['#ffbf36', '#ffffff'], 'willow', false, false, false, false, 0.42),
    ('codepen-gold-crackle', 'CodePen Gold Crackle', 'Gold crackle chrysanthemum with delayed micro-bursts.', 'shell', 'crackle', 5.0, 90, 3.2, array['#ffbf36', '#ffffff'], 'light', true, false, false, true, 0.3),
    ('codepen-red-horsetail', 'CodePen Red Horsetail', 'Red horsetail spilling downward from a compact break.', 'shell', 'horsetail', 5.8, 88, 3.0, array['#ff0043', '#ffbf36'], 'medium', false, false, false, false, 0.34),
    ('codepen-comet-gold', 'CodePen Gold Comet', 'Standalone gold comet with no large aerial break.', 'comet', 'comet', 3.0, 58, 1.8, array['#ffbf36', '#ffffff'], 'streamer', false, true, false, false, 0.16),
    ('codepen-red-mine', 'CodePen Red Mine', 'Ground-level red fan mine.', 'mine', 'mine', 2.6, 26, 2.0, array['#ff0043', '#ffffff'], 'light', false, false, false, false, 0.24),
    ('codepen-white-finale-shell', 'CodePen White Finale Shell', 'High-density white and gold finale shell.', 'shell', 'chrysanthemum', 5.2, 96, 3.8, array['#ffffff', '#ffbf36'], 'thick', true, true, false, false, 0.36)
)
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
  version,
  spec_json
)
select
  slug,
  name,
  description,
  type,
  duration_seconds,
  1,
  height_meters,
  'catalogue',
  1,
  3,
  jsonb_build_object(
    'version', 3,
    'name', name,
    'description', description,
    'source', 'catalogue',
    'confidence', 1,
    'seed', abs(('x' || substr(md5(slug), 1, 8))::bit(32)::int),
    'type', type,
    'durationSeconds', duration_seconds,
    'colorPalette', to_jsonb(colors),
    'renderProfile', jsonb_build_object(
      'quality', 'high',
      'maxParticles', 120000,
      'maxTrailSegments', 260000,
      'useSmoke', true,
      'useSkyLighting', true,
      'deterministic', true,
      'pixelRatioLimit', 2
    ),
    'shell', jsonb_build_object(
      'family', family,
      'size', size,
      'starDensity', case when family in ('floral', 'palm') then 0.45 else 1.05 end,
      'color', colors[1],
      'secondColor', case when array_length(colors, 1) > 1 then colors[2] else null end,
      'glitter', glitter,
      'glitterColor', case when glitter in ('none') then null else '#ffbf36' end,
      'pistil', pistil,
      'pistilColor', case when pistil then '#ffbf36' else null end,
      'streamers', streamers,
      'crossette', family = 'crossette',
      'floral', family = 'floral',
      'fallingLeaves', family = 'falling_leaves',
      'crackle', crackle,
      'strobe', strobe,
      'horsetail', family = 'horsetail',
      'ring', family = 'ring',
      'smokeAmount', smoke_amount
    ),
    'launch', jsonb_build_object(
      'enabled', type <> 'mine',
      'fuseTimeSeconds', 0,
      'liftTimeSeconds', case when type = 'mine' then 0.08 when type = 'comet' then 0.9 else 1.15 end,
      'heightMeters', height_meters,
      'startPosition', jsonb_build_object('x', 0, 'y', 0, 'z', 0),
      'panDegrees', 0,
      'tiltDegrees', 90,
      'tracerColor', colors[1],
      'sparkFrequency', 32,
      'sparkLifeMs', 320,
      'sparkSpeed', 0.5,
      'randomWobble', 0.035
    ),
    'shots', jsonb_build_array(
      jsonb_build_object(
        'index', 0,
        'timeOffsetSeconds', 0,
        'position', jsonb_build_object('x', 0, 'y', 0, 'z', 0),
        'scale', 1,
        'seedOffset', 0
      )
    ),
    'metadata', jsonb_build_object(
      'seededBy', 'seed-codepen-fireworks-v3.sql',
      'sourceInspiration', 'CodePen MillerTime XgpNwb',
      'palette', jsonb_build_object(
        'Red', '#ff0043',
        'Green', '#14fc56',
        'Blue', '#1e7fff',
        'Purple', '#e60aff',
        'Gold', '#ffbf36',
        'White', '#ffffff'
      )
    )
  )
from codepen_effects
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
  version = excluded.version,
  spec_json = excluded.spec_json,
  updated_at = now();
