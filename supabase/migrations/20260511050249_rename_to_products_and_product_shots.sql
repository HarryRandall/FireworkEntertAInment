-- Phase 2A of the schema restructure: rename and restructure the catalogue.
--
-- catalogue_products -> products: the "catalogue" was always just the products
--   our suppliers sell. The empty products table from the abandoned 0014
--   migration was dropped in Phase 1, freeing this name.
-- product_effect_sequences -> product_shots: each row is literally one shot
--   fired from the product. "sequence" was vague.
-- products.firework_subtype -> products.subtype: less redundant.
-- products: drop unused columns (category, firework_type, source_table,
--   source_payload). Importer metadata still lives in import_outputs.
-- product_shots: drop color (visual data lives on effect_specs.spec_json);
--   add shot_index (1-based order within a product, computed from current
--   time_offset_seconds ordering) so future UIs can sort/edit by index.
-- show_cues.catalogue_product_id -> show_cues.product_id and
-- import_jobs.approved_catalogue_product_id -> approved_product_id for
--   consistency with the renamed table.

ALTER TABLE public.catalogue_products RENAME TO products;

ALTER TABLE public.products
  DROP COLUMN IF EXISTS category,
  DROP COLUMN IF EXISTS firework_type,
  DROP COLUMN IF EXISTS source_table,
  DROP COLUMN IF EXISTS source_payload;

ALTER TABLE public.products RENAME COLUMN firework_subtype TO subtype;
ALTER INDEX IF EXISTS catalogue_products_subtype_idx RENAME TO products_subtype_idx;

ALTER TABLE public.product_effect_sequences RENAME TO product_shots;
ALTER INDEX IF EXISTS idx_pes_product_id RENAME TO idx_product_shots_product_id;

ALTER TABLE public.product_shots DROP COLUMN IF EXISTS color;
ALTER TABLE public.product_shots ADD COLUMN IF NOT EXISTS shot_index integer;

WITH ordered AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY product_id
                            ORDER BY time_offset_seconds, id) AS idx
  FROM public.product_shots
)
UPDATE public.product_shots ps
SET shot_index = ordered.idx
FROM ordered
WHERE ordered.id = ps.id;

ALTER TABLE public.product_shots ALTER COLUMN shot_index SET NOT NULL;
ALTER TABLE public.product_shots
  ADD CONSTRAINT product_shots_unique_index UNIQUE (product_id, shot_index);
ALTER TABLE public.product_shots
  ADD CONSTRAINT product_shots_time_offset_nonneg CHECK (time_offset_seconds >= 0);

ALTER TABLE public.show_cues RENAME COLUMN catalogue_product_id TO product_id;
ALTER TABLE public.show_cues RENAME CONSTRAINT show_cues_catalogue_product_id_fkey TO show_cues_product_id_fkey;

ALTER TABLE public.import_jobs RENAME COLUMN approved_catalogue_product_id TO approved_product_id;
ALTER TABLE public.import_jobs RENAME CONSTRAINT import_jobs_approved_catalogue_product_id_fkey TO import_jobs_approved_product_id_fkey;

ALTER POLICY product_effect_sequences_select_authenticated ON public.product_shots RENAME TO product_shots_select_authenticated;
ALTER POLICY product_effect_sequences_admin_write ON public.product_shots RENAME TO product_shots_admin_write;
ALTER POLICY catalogue_products_select_authenticated ON public.products RENAME TO products_select_authenticated;
ALTER POLICY catalogue_products_admin_modify ON public.products RENAME TO products_admin_modify;
