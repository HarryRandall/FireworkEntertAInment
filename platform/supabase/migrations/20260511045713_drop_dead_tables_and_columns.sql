-- Phase 1 of the schema restructure: prune tables and columns that no
-- production code reads or writes.
--
-- Dead tables:
--   "Wikifireworks sample database" / "Finale3D CSV Import Sample" -- raw
--     supplier CSV imports surfaced only in the deleted /dev/db-test page.
--   products (the 0-row table from the never-properly-applied
--     0014_products_table.sql migration). Phase 2 will rename
--     catalogue_products -> products to take this name.
--   vdl_terms -- never queried from app code.
--   inferred_video_observations -- never queried from app code; the
--     importer pipeline writes to import_outputs instead.
--
-- Dead show_cues columns (all uniformly default/null across 221 rows):
--   position_json     -- always {x:0,y:0,z:0}
--   rotation_json     -- always {pan:0,roll:0,tilt:90}
--   render_params     -- always null
--   overrides_json    -- always {}
--   scale             -- always 1.000
--   firework_product_id -- always null; legacy FK to the 0-row products table

DROP TABLE IF EXISTS public."Wikifireworks sample database" CASCADE;
DROP TABLE IF EXISTS public."Finale3D CSV Import Sample" CASCADE;
DROP TABLE IF EXISTS public.vdl_terms CASCADE;
DROP TABLE IF EXISTS public.inferred_video_observations CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;

ALTER TABLE public.show_cues
  DROP COLUMN IF EXISTS position_json,
  DROP COLUMN IF EXISTS rotation_json,
  DROP COLUMN IF EXISTS render_params,
  DROP COLUMN IF EXISTS overrides_json,
  DROP COLUMN IF EXISTS scale,
  DROP COLUMN IF EXISTS firework_product_id;
