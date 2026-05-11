-- Phase 2B of the schema restructure.
--
-- Goal: every show_cues row goes through show_cues.product_id ->
-- product_shots -> effect_specs. After this migration there is one
-- canonical path, and show_cues.effect_spec_id is gone.
--
-- Three classes of cues to deal with:
--
--   (a) Cues already pointing at a product_id (11 rows): keep as-is.
--
--   (b) Cues with only an effect_spec_id (126 rows): synthesise a single-shot
--       "wrapper product" per distinct effect_spec and point the cues at it.
--
--   (c) Cues with neither product_id nor effect_spec_id (84 rows across the
--       firework-renderer-demo + 4 firework-test-* dev shows). Their original
--       'demo-*' effect_specs were deleted by
--       0014_launch_positions_and_tube_index.sql, so the FK set null. They
--       cannot be revived -- delete them. The renderer-demo show has 4 real
--       cues that stay; the four firework-test-* shows become empty.

DELETE FROM public.show_cues
WHERE product_id IS NULL
  AND effect_spec_id IS NULL;

WITH orphan_specs AS (
  SELECT DISTINCT effect_spec_id
  FROM public.show_cues
  WHERE product_id IS NULL
    AND effect_spec_id IS NOT NULL
),
new_products AS (
  INSERT INTO public.products (part_number, name, manufacturer, subtype, duration_seconds, description)
  SELECT
    'auto-' || es.slug,
    es.name,
    'auto-generated wrapper',
    es.type,
    es.duration_seconds,
    COALESCE(es.description, 'Auto-generated single-shot wrapper for legacy show_cue.effect_spec_id rows.')
  FROM public.effect_specs es
  JOIN orphan_specs os ON os.effect_spec_id = es.id
  RETURNING id, part_number
),
links AS (
  SELECT
    np.id AS product_id,
    es.id AS effect_spec_id
  FROM new_products np
  JOIN public.effect_specs es ON 'auto-' || es.slug = np.part_number
),
new_shots AS (
  INSERT INTO public.product_shots (product_id, effect_spec_id, shot_index, time_offset_seconds, pan_degrees)
  SELECT product_id, effect_spec_id, 1, 0, 0
  FROM links
  RETURNING product_id, effect_spec_id
)
UPDATE public.show_cues sc
SET product_id = ns.product_id
FROM new_shots ns
WHERE sc.effect_spec_id = ns.effect_spec_id
  AND sc.product_id IS NULL;

ALTER TABLE public.show_cues DROP COLUMN IF EXISTS effect_spec_id;
ALTER TABLE public.show_cues ALTER COLUMN product_id SET NOT NULL;
