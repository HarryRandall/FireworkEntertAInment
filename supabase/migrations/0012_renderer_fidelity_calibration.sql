-- Calibrate the 3D renderer catalogue against the Caleb Miller-style shell model.
-- This is intentionally idempotent so existing local/demo databases can be brought
-- forward without recreating shows or deleting user cues.

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
  spec_json
)
values
  ('gold-chrysanthemum', 'Gold Chrysanthemum', 'Classic round burst with red pistil and light glitter.', 'shell', 4.4, 1, 80, 'manual', 1,
    '{"shellType":"crysanthemum","spreadSize":4.9,"starLifeMs":1500,"color":"#ffbf36","glitter":"light","glitterColor":"#ffbf36","pistil":true,"pistilColor":"#ff0043","starDensity":1.2}'::jsonb),
  ('blue-ring', 'Blue Ring', 'Blue ring shell with a gold pistil and clean light glitter.', 'shell', 4.0, 1, 82, 'manual', 1,
    '{"shellType":"ring","spreadSize":4.3,"starLifeMs":1450,"color":"#1e7fff","glitter":"light","glitterColor":"#ffffff","ring":true,"pistil":true,"pistilColor":"#ffbf36"}'::jsonb),
  ('willow-gold', 'Gold Willow', 'Long drooping gold willow with persistent streamer trails.', 'shell', 6.4, 1, 78, 'manual', 1,
    '{"shellType":"willow","spreadSize":4.2,"starLifeMs":3000,"color":"#ffbf36","glitter":"willow","glitterColor":"#ffbf36","starDensity":0.75}'::jsonb),
  ('red-crossette', 'Red Crossette', 'Red stars that split into four crossing arms.', 'shell', 3.8, 1, 76, 'manual', 1,
    '{"shellType":"crossette","spreadSize":3.9,"starLifeMs":1200,"starLifeVariation":0.34,"color":"#ff0043","crossette":true,"glitter":"medium","glitterColor":"#ffbf36","starDensity":0.82}'::jsonb),
  ('purple-crackle', 'Purple Crackle', 'Purple shell with a tight gold crackle finish.', 'shell', 3.6, 1, 76, 'manual', 1,
    '{"shellType":"crackle","spreadSize":4.0,"starLifeMs":1050,"starLifeVariation":0.28,"color":"#e60aff","crackle":true,"glitter":"light","glitterColor":"#ffbf36"}'::jsonb),
  ('green-palm', 'Green Palm', 'Heavy palm trunk with slower drooping fronds.', 'shell', 4.4, 1, 70, 'manual', 1,
    '{"shellType":"palm","spreadSize":4.3,"starLifeMs":1750,"color":"#14fc56","glitter":"heavy","glitterColor":"#ffbf36","starDensity":0.35}'::jsonb),
  ('white-strobe', 'White Strobe', 'High white strobe with a longer sparkling hang.', 'shell', 5.0, 1, 92, 'manual', 1,
    '{"shellType":"strobe","spreadSize":4.4,"starLifeMs":1900,"starLifeVariation":0.38,"color":"#ffffff","strobe":true,"strobeColor":"#ffffff","glitter":"none","starDensity":1.0}'::jsonb),
  ('falling-leaves', 'Falling Leaves', 'Low amber falling leaves with slow gold drift.', 'shell', 6.6, 1, 58, 'manual', 1,
    '{"shellType":"fallingLeaves","spreadSize":3.4,"starLifeMs":3000,"starLifeVariation":0.45,"color":"#ffbf36","fallingLeaves":true,"glitter":"medium","glitterColor":"#ffbf36","starDensity":0.18}'::jsonb),
  ('floral-pink', 'Floral Pink', 'Soft floral spread with a small white pistil.', 'shell', 4.0, 1, 74, 'manual', 1,
    '{"shellType":"floral","spreadSize":3.8,"starLifeMs":1200,"starLifeVariation":0.45,"color":"#e60aff","floral":true,"pistil":true,"pistilColor":"#ffffff","starDensity":0.18}'::jsonb),
  ('horsetail-red', 'Red Horsetail', 'Low red horsetail falling from the break point.', 'shell', 3.6, 1, 42, 'manual', 1,
    '{"shellType":"horsetail","spreadSize":3.2,"starLifeMs":1900,"color":"#ff0043","horsetail":true,"glitter":"medium","glitterColor":"#ffbf36"}'::jsonb),
  ('ghost-blue-green', 'Ghost Blue-Green', 'Blue shell that appears late and transitions to green.', 'shell', 4.8, 1, 82, 'manual', 1,
    '{"shellType":"ghost","spreadSize":4.3,"starLifeMs":1850,"color":"#1e7fff","secondColor":"#14fc56","transitionTimeMs":820,"streamers":true,"glitter":"none"}'::jsonb),
  ('comet-gold', 'Gold Comet', 'Single low gold streamer comet with a spinning lift.', 'comet', 2.8, 1, 42, 'manual', 1,
    '{"shellType":"comet","spreadSize":1.8,"starLifeMs":2600,"color":"#ffbf36","glitter":"streamer","glitterColor":"#ffbf36"}'::jsonb),
  ('demo-opening-comet', 'Demo Opening Comet', 'Low gold lift comet with streamer glitter.', 'comet', 2.8, 1, 42, 'manual', 1,
    '{"shellType":"comet","spreadSize":1.8,"starLifeMs":2600,"color":"#ffbf36","glitter":"streamer","glitterColor":"#ffbf36"}'::jsonb),
  ('demo-blue-ring', 'Demo Blue Ring', 'Medium-height blue ring with a warm pistil.', 'shell', 4.0, 1, 72, 'manual', 1,
    '{"shellType":"ring","spreadSize":4.2,"starLifeMs":1450,"color":"#1e7fff","ring":true,"pistil":true,"pistilColor":"#ffbf36","glitter":"light","glitterColor":"#ffffff"}'::jsonb),
  ('demo-red-crossette', 'Demo Red Crossette', 'Quick red crossette split with medium glitter.', 'shell', 3.8, 1, 76, 'manual', 1,
    '{"shellType":"crossette","spreadSize":3.9,"starLifeMs":1200,"starLifeVariation":0.34,"color":"#ff0043","crossette":true,"glitter":"medium","glitterColor":"#ffbf36","starDensity":0.82}'::jsonb),
  ('demo-gold-chrysanthemum', 'Demo Gold Chrysanthemum', 'Large round gold bloom with red pistil and light glitter.', 'shell', 4.4, 1, 82, 'manual', 1,
    '{"shellType":"crysanthemum","spreadSize":4.9,"starLifeMs":1500,"color":"#ffbf36","glitter":"light","glitterColor":"#ffbf36","pistil":true,"pistilColor":"#ff0043","starDensity":1.2}'::jsonb),
  ('demo-ghost-blue-green', 'Demo Ghost Blue-Green', 'Blue bloom that appears late and transitions into green.', 'shell', 4.8, 1, 84, 'manual', 1,
    '{"shellType":"ghost","spreadSize":4.3,"starLifeMs":1850,"color":"#1e7fff","secondColor":"#14fc56","transitionTimeMs":820,"streamers":true,"glitter":"none"}'::jsonb),
  ('demo-purple-crackle', 'Demo Purple Crackle', 'Short purple shell with gold crackle after-burst.', 'shell', 3.6, 1, 76, 'manual', 1,
    '{"shellType":"crackle","spreadSize":4.0,"starLifeMs":1050,"starLifeVariation":0.28,"color":"#e60aff","crackle":true,"glitter":"light","glitterColor":"#ffbf36"}'::jsonb),
  ('demo-white-strobe', 'Demo White Strobe', 'High white strobe with a longer hang.', 'shell', 5.0, 1, 92, 'manual', 1,
    '{"shellType":"strobe","spreadSize":4.4,"starLifeMs":1900,"starLifeVariation":0.38,"color":"#ffffff","strobe":true,"strobeColor":"#ffffff","glitter":"none","starDensity":1.0}'::jsonb),
  ('demo-falling-leaves', 'Demo Falling Leaves', 'Low slow amber falling leaves.', 'shell', 6.6, 1, 58, 'manual', 1,
    '{"shellType":"fallingLeaves","spreadSize":3.4,"starLifeMs":3000,"starLifeVariation":0.45,"color":"#ffbf36","fallingLeaves":true,"glitter":"medium","glitterColor":"#ffbf36","starDensity":0.18}'::jsonb),
  ('demo-gold-willow', 'Demo Gold Willow', 'Long drooping gold willow finale.', 'shell', 6.4, 1, 78, 'manual', 1,
    '{"shellType":"willow","spreadSize":4.2,"starLifeMs":3000,"color":"#ffbf36","glitter":"willow","glitterColor":"#ffbf36","starDensity":0.75}'::jsonb)
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
  spec_json = excluded.spec_json,
  updated_at = now();

update public.show_cues cue
set
  position_json = jsonb_build_object(
    'x', coalesce((cue.position_json->>'x')::numeric, 0),
    'y',
      case effect_specs.slug
        when 'demo-opening-comet' then 0.00
        when 'demo-blue-ring' then 0.10
        when 'demo-red-crossette' then 0.20
        when 'demo-gold-chrysanthemum' then 0.35
        when 'demo-ghost-blue-green' then 0.45
        when 'demo-purple-crackle' then 0.15
        when 'demo-white-strobe' then 0.55
        when 'demo-falling-leaves' then -0.10
        when 'demo-gold-willow' then 0.20
        else coalesce((cue.position_json->>'y')::numeric, 0)
      end,
    'z', coalesce((cue.position_json->>'z')::numeric, 0)
  ),
  scale =
    case effect_specs.slug
      when 'demo-gold-chrysanthemum' then 1.00
      when 'demo-white-strobe' then 1.00
      when 'demo-gold-willow' then 1.02
      when 'demo-falling-leaves' then 0.90
      else 1.00
    end,
  updated_at = now()
from public.effect_specs
where cue.effect_spec_id = effect_specs.id
  and effect_specs.slug like 'demo-%';
