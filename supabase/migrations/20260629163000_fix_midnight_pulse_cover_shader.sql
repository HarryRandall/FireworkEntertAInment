-- Midnight Pulse was inserted before presets had intentional cover shaders, so
-- the earlier backfill could leave it with a near-black random cover. Give the
-- preset a stable, palette-led cover that matches its azure/silver cue list.
UPDATE show_presets
SET
  cover_shader = jsonb_build_object(
    'kind', 'mesh-gradient',
    'colors', jsonb_build_array('#4d9fe8', '#00e5ff', '#8b5cf6', '#f4f1ea'),
    'speed', 1.05,
    'scale', 0.72,
    'rotation', 24,
    'frame', 38100,
    'softness', 0.46,
    'intensity', 0.62,
    'distortion', 0.58,
    'swirl', 0.34,
    'grainMixer', 0.02,
    'stepsPerColor', 3,
    'density', 0.18,
    'spotty', 0.34,
    'midSize', 0.3,
    'midIntensity', 0.56,
    'warpShape', 'stripes',
    'grainShape', 'wave',
    'shapeScale', 0.28,
    'proportion', 0.42,
    'swirlIterations', 14
  ),
  updated_at = now()
WHERE slug = 'midnight-pulse';
