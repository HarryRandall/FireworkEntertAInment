-- Shader "cover" identity, generated once and stored as JSON. Shows use it on
-- the generating screen; presets use it as library cover art.
ALTER TABLE shows ADD COLUMN IF NOT EXISTS cover_shader jsonb;
ALTER TABLE show_presets ADD COLUMN IF NOT EXISTS cover_shader jsonb;

CREATE OR REPLACE FUNCTION pg_temp.random_shader_cover()
RETURNS jsonb
LANGUAGE sql
VOLATILE
AS $$
  WITH palette AS (
    SELECT colors
    FROM (
      VALUES
        (ARRAY['#00e5ff', '#3b82f6', '#8b5cf6', '#ff3df2']),
        (ARRAY['#33fff5', '#4d9fe8', '#8b5cf6', '#f4f1ea']),
        (ARRAY['#00ff9c', '#00e5ff', '#3b82f6', '#f5f7fa']),
        (ARRAY['#ff3df2', '#8b5cf6', '#00e5ff', '#ffd166']),
        (ARRAY['#ff4d6d', '#ff3df2', '#8b5cf6', '#f5f7fa']),
        (ARRAY['#4d9fe8', '#00e5ff', '#00ff9c', '#f5f7fa'])
    ) AS p(colors)
    ORDER BY random()
    LIMIT 1
  ),
  picked AS (
    SELECT
      (ARRAY['grain-gradient', 'mesh-gradient', 'warp', 'simplex-noise', 'god-rays'])[1 + floor(random() * 5)::int] AS kind,
      (ARRAY['checks', 'stripes', 'edge'])[1 + floor(random() * 3)::int] AS warp_shape,
      (ARRAY['wave', 'dots', 'truchet', 'corners', 'ripple', 'blob', 'sphere'])[1 + floor(random() * 7)::int] AS grain_shape,
      colors
    FROM palette
  )
  SELECT jsonb_build_object(
    'kind', kind,
    'colors', to_jsonb(colors),
    'speed', round((0.8 + random() * 1.6)::numeric, 2)::float8,
    'scale', round((0.5 + random() * 0.6)::numeric, 2)::float8,
    'rotation', floor(random() * 361)::int,
    'frame', floor(random() * 120001)::int,
    'softness', round(random()::numeric, 2)::float8,
    'intensity', round((0.35 + random() * 0.65)::numeric, 2)::float8,
    'distortion', round((0.15 + random() * 0.85)::numeric, 2)::float8,
    'swirl', round(random()::numeric, 2)::float8,
    'grainMixer', round((random() * 0.1)::numeric, 2)::float8,
    'stepsPerColor', 1 + floor(random() * 6)::int,
    'density', round((0.03 + random() * 0.47)::numeric, 2)::float8,
    'spotty', round((0.05 + random() * 0.8)::numeric, 2)::float8,
    'midSize', round((0.05 + random() * 0.6)::numeric, 2)::float8,
    'midIntensity', round((0.15 + random() * 0.85)::numeric, 2)::float8,
    'warpShape', warp_shape,
    'grainShape', grain_shape,
    'shapeScale', CASE
      WHEN warp_shape = 'edge' THEN 0
      ELSE round((0.05 + random() * 0.85)::numeric, 2)::float8
    END,
    'proportion', round((0.08 + random() * 0.8)::numeric, 2)::float8,
    'swirlIterations', 10 + floor(random() * 11)::int
  )
  FROM picked;
$$;

UPDATE shows
SET cover_shader = pg_temp.random_shader_cover()
WHERE cover_shader IS NULL;

UPDATE show_presets
SET cover_shader = pg_temp.random_shader_cover()
WHERE cover_shader IS NULL;
