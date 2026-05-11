-- Schema additions for the Lallassu-style renderer rewrite.
--
-- 1. shows.launch_positions_json: per-show array of three mortar positions
--    (x/y/z in scene units). Defaults place the mortars left/centre/right
--    on the ground plane.
-- 2. show_cues.launch_position_index: which of the three mortars (0..2)
--    a cue fires from. Defaults to the centre mortar.
-- 3. Wipe the legacy effect_specs presets seeded by 0012 so the renderer
--    only has the new Lallassu-shaped designs to choose from. New seeds
--    live in supabase/seed-lallassu-designs.sql.

alter table public.shows
  add column if not exists launch_positions_json jsonb not null default
    '[{"x":-200,"y":0,"z":0},{"x":0,"y":0,"z":0},{"x":200,"y":0,"z":0}]'::jsonb;

alter table public.show_cues
  add column if not exists launch_position_index smallint not null default 0;

alter table public.show_cues
  drop constraint if exists show_cues_launch_position_index_check;

alter table public.show_cues
  add constraint show_cues_launch_position_index_check
    check (launch_position_index between 0 and 2);

-- Drop legacy/manual presets so the renderer only sees Lallassu-shaped
-- designs. effect_specs rows authored by the importer pipeline (source
-- 'video_inferred', 'llm_generated', etc.) are preserved for the admin UI.
delete from public.effect_specs
  where source = 'manual'
     or slug like 'demo-%';
