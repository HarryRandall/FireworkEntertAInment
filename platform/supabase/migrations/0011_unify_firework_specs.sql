-- Unify firework spec storage around a single FireworkSpec format.
-- Removes the v2/v3 version split, drops the legacy firework_specifications
-- table, and clears any seeded data so the unified spec can take over.

-- Drop FK columns that referenced the legacy table before dropping the table.
alter table public.show_cues
  drop column if exists firework_specification_id;

alter table public.catalogue_products
  drop column if exists firework_specification_id;

drop table if exists public.firework_specifications cascade;

-- Remove v2/v3 seed rows and the version discriminator entirely.
truncate table public.inferred_video_observations cascade;
truncate table public.effect_specs cascade;

alter table public.effect_specs
  drop constraint if exists effect_specs_version_check;

alter table public.effect_specs
  drop column if exists version;

comment on column public.effect_specs.spec_json is
  'Unified FireworkSpec JSON (shellType, spreadSize, starLifeMs, colour, glitter, ...).';

comment on column public.show_cues.effect_spec_id is
  'Firework effect referenced by this cue.';

-- Seed one exemplar FireworkSpec per shell type so the catalogue is usable
-- immediately after migration. Matches the shape exported by lib/fireworks/spec.ts.
insert into public.effect_specs (slug, name, description, type, duration_seconds, shot_count, height_meters, source, confidence, spec_json)
values
  ('gold-chrysanthemum', 'Gold Chrysanthemum', 'Classic round burst with a light glitter tail.', 'shell', 4.2, 1, 80, 'manual', 1,
    '{"shellType":"crysanthemum","spreadSize":5.2,"starLifeMs":1600,"color":"#ffbf36","glitter":"light","glitterColor":"#ffbf36","pistil":true,"pistilColor":"#ff0043"}'::jsonb),
  ('blue-ring', 'Blue Ring', 'Tilted ring shell with a gold pistil.', 'shell', 3.8, 1, 82, 'manual', 1,
    '{"shellType":"ring","spreadSize":4.6,"starLifeMs":1500,"color":"#1e7fff","glitter":"light","ring":true,"pistil":true,"pistilColor":"#ffbf36"}'::jsonb),
  ('willow-gold', 'Gold Willow', 'Long-drooping willow with heavy trails.', 'shell', 5.6, 1, 78, 'manual', 1,
    '{"shellType":"willow","spreadSize":4.4,"starLifeMs":2800,"color":"#ffbf36","glitter":"willow","glitterColor":"#ffbf36"}'::jsonb),
  ('red-crossette', 'Red Crossette', 'Each star splits into four crossing arms.', 'shell', 3.6, 1, 80, 'manual', 1,
    '{"shellType":"crossette","spreadSize":4.2,"starLifeMs":1400,"color":"#ff0043","crossette":true,"glitter":"medium"}'::jsonb),
  ('purple-crackle', 'Purple Crackle', 'Purple shell with crackling gold bees on death.', 'shell', 3.4, 1, 80, 'manual', 1,
    '{"shellType":"crackle","spreadSize":4.0,"starLifeMs":1200,"color":"#e60aff","crackle":true,"glitter":"light"}'::jsonb),
  ('green-palm', 'Green Palm', 'Heavy palm trunk with drooping fronds.', 'shell', 4.0, 1, 72, 'manual', 1,
    '{"shellType":"palm","spreadSize":4.8,"starLifeMs":1800,"color":"#14fc56","glitter":"heavy","glitterColor":"#ffbf36"}'::jsonb),
  ('white-strobe', 'White Strobe', 'Flashing white strobe star pattern.', 'shell', 4.4, 1, 80, 'manual', 1,
    '{"shellType":"strobe","spreadSize":4.4,"starLifeMs":2000,"color":"#ffffff","strobe":true,"strobeColor":"#ffffff"}'::jsonb),
  ('falling-leaves', 'Falling Leaves', 'Slow-drifting amber leaves.', 'shell', 6.0, 1, 74, 'manual', 1,
    '{"shellType":"fallingLeaves","spreadSize":3.8,"starLifeMs":3200,"color":"#ffbf36","fallingLeaves":true,"glitter":"medium"}'::jsonb),
  ('floral-pink', 'Floral Pink', 'Soft floral spread with pistil burst.', 'shell', 4.2, 1, 78, 'manual', 1,
    '{"shellType":"floral","spreadSize":4.4,"starLifeMs":1600,"color":"#e60aff","floral":true,"pistil":true,"pistilColor":"#ffffff"}'::jsonb),
  ('horsetail-red', 'Red Horsetail', 'Downward spray from low altitude.', 'shell', 3.2, 1, 40, 'manual', 1,
    '{"shellType":"horsetail","spreadSize":3.6,"starLifeMs":1400,"color":"#ff0043","horsetail":true,"glitter":"light"}'::jsonb),
  ('ghost-blue-green', 'Ghost Blue-Green', 'Blue shell that transitions to green.', 'shell', 4.4, 1, 82, 'manual', 1,
    '{"shellType":"ghost","spreadSize":4.6,"starLifeMs":1700,"color":"#1e7fff","secondColor":"#14fc56","transitionTimeMs":900}'::jsonb),
  ('comet-gold', 'Gold Comet', 'Single rising comet with sparks.', 'comet', 2.4, 1, 72, 'manual', 1,
    '{"shellType":"comet","spreadSize":2.0,"starLifeMs":1200,"color":"#ffbf36","glitter":"streamer","glitterColor":"#ffbf36"}'::jsonb);

