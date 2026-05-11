-- Mirror of the migration that was applied directly to the remote project
-- (recorded as supabase_migrations.schema_migrations version 20260511030304).
-- Filename keeps the same version string so `supabase db push` sees it as
-- already-applied and does not re-run it.
--
-- What it does:
--   1. Creates product_effect_sequences (canonical "shots fired by a product").
--   2. Adds show_cues.catalogue_product_id and backfills from the old
--      catalogue_products.effect_spec_id chain.
--   3. Replaces the 5 composite ha-* effect_specs (which embedded shots[]
--      in spec_json) with 6 pure ha-effect-* designs.
--   4. Populates product_effect_sequences from the old shots[] payloads.
--   5. Drops catalogue_products.effect_spec_id and the obsolete composite
--      ha-* effect_specs.
--
-- NOTE: a follow-up migration 0015_product_effect_sequences_rls.sql adds
-- the SELECT policy that this migration omitted, which was the root cause
-- of preview firing only one shot per multi-shot product.

-- 1. Create product_effect_sequences
CREATE TABLE product_effect_sequences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES catalogue_products(id) ON DELETE CASCADE,
  effect_spec_id uuid NOT NULL REFERENCES effect_specs(id) ON DELETE RESTRICT,
  time_offset_seconds numeric NOT NULL DEFAULT 0,
  pan_degrees integer NOT NULL DEFAULT 0,
  color text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_pes_product_id ON product_effect_sequences(product_id);

-- 2. Add catalogue_product_id to show_cues
ALTER TABLE show_cues ADD COLUMN catalogue_product_id uuid REFERENCES catalogue_products(id);

-- 3. Backfill show_cues.catalogue_product_id via effect_spec chain
UPDATE show_cues sc
SET catalogue_product_id = cp.id
FROM catalogue_products cp
WHERE sc.effect_spec_id = cp.effect_spec_id
  AND cp.effect_spec_id IS NOT NULL;

-- 4. Create pure effect_specs for H&A effect types
INSERT INTO effect_specs (slug, name, type, duration_seconds, shot_count, height_meters, source, confidence, spec_json)
VALUES
  ('ha-effect-blue-comet',   'Blue Comet',   'shell', 1.8, 1, 9.1,  'catalogue', 1.0, '{"shellType":"comet","color":"#1e7fff","spreadSize":0.91,"starLifeMs":1004}'::jsonb),
  ('ha-effect-green-comet',  'Green Comet',  'shell', 1.8, 1, 9.1,  'catalogue', 1.0, '{"shellType":"comet","color":"#14fc56","spreadSize":0.91,"starLifeMs":1004}'::jsonb),
  ('ha-effect-red-comet',    'Red Comet',    'shell', 1.8, 1, 9.1,  'catalogue', 1.0, '{"shellType":"comet","color":"#ff0043","spreadSize":0.91,"starLifeMs":1004}'::jsonb),
  ('ha-effect-gold-palm',    'Gold Palm',    'shell', 1.8, 1, 9.1,  'catalogue', 1.0, '{"shellType":"palm","color":"#ffbf36","spreadSize":0.91,"starLifeMs":2342}'::jsonb),
  ('ha-effect-silver-palm',  'Silver Palm',  'shell', 1.8, 1, 9.1,  'catalogue', 1.0, '{"shellType":"palm","color":"#cccccc","spreadSize":0.91,"starLifeMs":2342}'::jsonb),
  ('ha-effect-white-willow', 'White Willow', 'shell', 1.8, 1, 30.0, 'catalogue', 1.0, '{"shellType":"willow","color":"#ffffff","spreadSize":3.0,"starLifeMs":2880}'::jsonb);

-- 5. Populate product_effect_sequences from the old shots[] payloads

-- BLUE STEEL -> blue comet
INSERT INTO product_effect_sequences (product_id, effect_spec_id, time_offset_seconds, pan_degrees, color)
SELECT
  cp.id,
  (SELECT id FROM effect_specs WHERE slug = 'ha-effect-blue-comet'),
  (shot->>'timeOffsetSeconds')::numeric,
  COALESCE((shot->>'panDegrees')::integer, 0),
  shot->>'color'
FROM catalogue_products cp
JOIN effect_specs es ON es.id = cp.effect_spec_id
CROSS JOIN jsonb_array_elements(es.spec_json->'shots') AS shot
WHERE es.slug = 'ha-blue-steel';

-- GO FOR GREEN -> green comet
INSERT INTO product_effect_sequences (product_id, effect_spec_id, time_offset_seconds, pan_degrees, color)
SELECT
  cp.id,
  (SELECT id FROM effect_specs WHERE slug = 'ha-effect-green-comet'),
  (shot->>'timeOffsetSeconds')::numeric,
  COALESCE((shot->>'panDegrees')::integer, 0),
  shot->>'color'
FROM catalogue_products cp
JOIN effect_specs es ON es.id = cp.effect_spec_id
CROSS JOIN jsonb_array_elements(es.spec_json->'shots') AS shot
WHERE es.slug = 'ha-go-for-green';

-- STOP SIGN RED -> red comet
INSERT INTO product_effect_sequences (product_id, effect_spec_id, time_offset_seconds, pan_degrees, color)
SELECT
  cp.id,
  (SELECT id FROM effect_specs WHERE slug = 'ha-effect-red-comet'),
  (shot->>'timeOffsetSeconds')::numeric,
  COALESCE((shot->>'panDegrees')::integer, 0),
  shot->>'color'
FROM catalogue_products cp
JOIN effect_specs es ON es.id = cp.effect_spec_id
CROSS JOIN jsonb_array_elements(es.spec_json->'shots') AS shot
WHERE es.slug = 'ha-stop-sign-red';

-- ROCK ON -> gold palm (silver palm for #cccccc shots)
INSERT INTO product_effect_sequences (product_id, effect_spec_id, time_offset_seconds, pan_degrees, color)
SELECT
  cp.id,
  CASE
    WHEN shot->>'color' = '#cccccc'
      THEN (SELECT id FROM effect_specs WHERE slug = 'ha-effect-silver-palm')
    ELSE
      (SELECT id FROM effect_specs WHERE slug = 'ha-effect-gold-palm')
  END,
  (shot->>'timeOffsetSeconds')::numeric,
  COALESCE((shot->>'panDegrees')::integer, 0),
  shot->>'color'
FROM catalogue_products cp
JOIN effect_specs es ON es.id = cp.effect_spec_id
CROSS JOIN jsonb_array_elements(es.spec_json->'shots') AS shot
WHERE es.slug = 'ha-rock-on';

-- HAMMER TIME -> white willow (placeholder single shot)
INSERT INTO product_effect_sequences (product_id, effect_spec_id, time_offset_seconds, pan_degrees, color)
SELECT
  cp.id,
  (SELECT id FROM effect_specs WHERE slug = 'ha-effect-white-willow'),
  0,
  0,
  NULL
FROM catalogue_products cp
JOIN effect_specs es ON es.id = cp.effect_spec_id
WHERE es.slug = 'ha-hammer-time';

-- 6. Re-point show_cues.effect_spec_id to the new pure effect_specs
UPDATE show_cues sc
SET effect_spec_id = (
  SELECT pes.effect_spec_id
  FROM product_effect_sequences pes
  WHERE pes.product_id = sc.catalogue_product_id
  ORDER BY pes.time_offset_seconds ASC
  LIMIT 1
)
WHERE sc.catalogue_product_id IS NOT NULL;

-- 7. Drop catalogue_products.effect_spec_id
ALTER TABLE catalogue_products DROP COLUMN effect_spec_id;

-- 8. Delete obsolete composite ha-* effect_specs (pure ha-effect-* are kept)
DELETE FROM effect_specs WHERE slug LIKE 'ha-%' AND slug NOT LIKE 'ha-effect-%';
