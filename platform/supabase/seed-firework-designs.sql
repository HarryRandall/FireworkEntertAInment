-- Seed the renderer's firework designs into effect_specs.
--
-- Each row stores a FireworkDesign JSON in spec_json (see
-- platform/lib/fireworks/design.ts). The renderer parses spec_json with
-- safeParseFireworkDesign() at cue-fire time.
--
-- Idempotent: re-running this updates existing rows in place.

insert into public.effect_specs (
  slug, name, description, type, duration_seconds, shot_count,
  height_meters, source, confidence, spec_json
) values
  -- Fibonacci-sphere bursts (seed 1) — the round, even radial pattern.
  ('fib-gold', 'Gold Sphere', 'Round gold burst with strobing flair and crackle.',
    'shell', 6.0, 1, 220, 'manual', 1,
    '{"size":220,"pattern":"fibonacci","color":{"r":1.0,"g":0.78,"b":0.21},
      "burst":{"speed":[2,4],"gravity":[-1.6,-0.2],"life":[0.8,5.5],"flairColorMode":"bombColor"},
      "flair":{"enabled":true},
      "crackle":{"enabled":true,"probability":0.06,"sound":"crackle"},
      "sound":{"boom":"auto"},"mortar":{"smokeParticles":120,"sound":true}}'::jsonb),

  ('fib-red', 'Red Sphere', 'Round red burst, classic chrysanthemum feel.',
    'shell', 6.0, 1, 220, 'manual', 1,
    '{"size":200,"pattern":"fibonacci","color":{"r":1.0,"g":0.05,"b":0.18},
      "burst":{"speed":[2,3.6],"gravity":[-1.5,-0.2],"life":[0.7,5.0],"flairColorMode":"bombColor"},
      "flair":{"enabled":true},
      "crackle":{"enabled":true,"probability":0.05,"sound":"lightBoom"},
      "sound":{"boom":"auto"},"mortar":{"smokeParticles":110,"sound":true}}'::jsonb),

  ('fib-blue', 'Blue Sphere', 'Cool blue radial burst with light flair.',
    'shell', 5.5, 1, 200, 'manual', 1,
    '{"size":180,"pattern":"fibonacci","color":{"r":0.18,"g":0.5,"b":1.0},
      "burst":{"speed":[2.2,3.8],"gravity":[-1.3,-0.1],"life":[0.6,4.5],"flairColorMode":"mixed"},
      "flair":{"enabled":true},
      "crackle":{"enabled":false,"probability":0,"sound":"crackle"},
      "sound":{"boom":"light"},"mortar":{"smokeParticles":90,"sound":true}}'::jsonb),

  ('fib-green', 'Green Sphere', 'Vivid green chrysanthemum with light glitter trails.',
    'shell', 5.6, 1, 200, 'manual', 1,
    '{"size":180,"pattern":"fibonacci","color":{"r":0.18,"g":1.0,"b":0.32},
      "burst":{"speed":[2,3.6],"gravity":[-1.4,-0.2],"life":[0.6,4.6],"flairColorMode":"bombColor"},
      "flair":{"enabled":true},
      "crackle":{"enabled":true,"probability":0.04,"sound":"crackle"},
      "sound":{"boom":"light"},"mortar":{"smokeParticles":95,"sound":true}}'::jsonb),

  ('fib-mega', 'Mega Gold Bloom', 'Huge gold bloom with heavy boom and rich crackle.',
    'shell', 7.5, 1, 260, 'manual', 1,
    '{"size":340,"pattern":"fibonacci","color":{"r":1.0,"g":0.78,"b":0.21},
      "burst":{"speed":[2.5,4.5],"gravity":[-2.0,-0.2],"life":[1.0,6.0],"flairColorMode":"bombColor"},
      "flair":{"enabled":true},
      "crackle":{"enabled":true,"probability":0.08,"sound":"heavyBoom"},
      "sound":{"boom":"heavy"},"mortar":{"smokeParticles":160,"sound":true}}'::jsonb),

  -- Wave bursts (seed 2) — sinusoidal stars that swirl while ascending.
  ('wave-rainbow', 'Rainbow Wave', 'Sine-wave burst with mixed flair colours.',
    'shell', 6.5, 1, 220, 'manual', 1,
    '{"size":220,"pattern":"wave","color":"random",
      "burst":{"speed":[2,4],"gravity":[-1.4,-0.1],"life":[0.7,5.2],"flairColorMode":"mixed"},
      "flair":{"enabled":true},
      "crackle":{"enabled":true,"probability":0.05,"sound":"lightBoom"},
      "sound":{"boom":"auto"},"mortar":{"smokeParticles":110,"sound":true}}'::jsonb),

  ('wave-purple', 'Purple Wave', 'Slow swirling purple stars with crackle ends.',
    'shell', 6.0, 1, 200, 'manual', 1,
    '{"size":180,"pattern":"wave","color":{"r":0.9,"g":0.04,"b":1.0},
      "burst":{"speed":[1.8,3.2],"gravity":[-1.2,-0.1],"life":[0.8,5.0],"flairColorMode":"bombColor"},
      "flair":{"enabled":true},
      "crackle":{"enabled":true,"probability":0.06,"sound":"crackle"},
      "sound":{"boom":"light"},"mortar":{"smokeParticles":95,"sound":true}}'::jsonb),

  ('wave-cyan', 'Cyan Wave', 'Bright cyan stars with sweeping wave trajectories.',
    'shell', 6.0, 1, 210, 'manual', 1,
    '{"size":200,"pattern":"wave","color":{"r":0.18,"g":0.95,"b":1.0},
      "burst":{"speed":[2.2,3.8],"gravity":[-1.4,-0.1],"life":[0.7,4.8],"flairColorMode":"mixed"},
      "flair":{"enabled":true},
      "crackle":{"enabled":false,"probability":0,"sound":"crackle"},
      "sound":{"boom":"auto"},"mortar":{"smokeParticles":100,"sound":true}}'::jsonb),

  -- Strobe bursts (seed 3) — flickering size + colour, heavy sound.
  ('strobe-white', 'White Strobe', 'Heavy strobing white shell with deep boom.',
    'shell', 5.5, 1, 220, 'manual', 1,
    '{"size":260,"pattern":"strobe","color":{"r":1.0,"g":1.0,"b":1.0},
      "burst":{"speed":[2,3.5],"gravity":[-1.6,-0.3],"life":[0.6,5.0],
        "flairSizeStrobe":[10,150],"flairColorMode":"mixed"},
      "flair":{"enabled":true},
      "crackle":{"enabled":true,"probability":0.07,"sound":"heavyBoom"},
      "sound":{"boom":"heavy"},"mortar":{"smokeParticles":140,"sound":true}}'::jsonb),

  ('strobe-red', 'Red Strobe', 'Aggressive red strobe with pulsing brightness.',
    'shell', 5.2, 1, 210, 'manual', 1,
    '{"size":230,"pattern":"strobe","color":{"r":1.0,"g":0.05,"b":0.18},
      "burst":{"speed":[2,3.4],"gravity":[-1.6,-0.3],"life":[0.5,4.5],
        "flairSizeStrobe":[10,150],"flairColorMode":"bombColor"},
      "flair":{"enabled":true},
      "crackle":{"enabled":true,"probability":0.07,"sound":"heavyBoom"},
      "sound":{"boom":"heavy"},"mortar":{"smokeParticles":130,"sound":true}}'::jsonb),

  ('strobe-mixed', 'Mixed Strobe', 'Random-colour strobing storm with crackle.',
    'shell', 5.8, 1, 220, 'manual', 1,
    '{"size":280,"pattern":"strobe","color":"random",
      "burst":{"speed":[2.2,4],"gravity":[-1.8,-0.2],"life":[0.7,5.5],
        "flairSizeStrobe":[10,150],"flairColorMode":"mixed"},
      "flair":{"enabled":true},
      "crackle":{"enabled":true,"probability":0.08,"sound":"heavyBoom"},
      "sound":{"boom":"heavy"},"mortar":{"smokeParticles":140,"sound":true}}'::jsonb),

  ('fib-mini', 'Mini Sphere', 'Small fast bloom for quick volleys.',
    'shell', 3.5, 1, 140, 'manual', 1,
    '{"size":80,"pattern":"fibonacci","color":"random",
      "burst":{"speed":[1.6,3],"gravity":[-1.2,-0.1],"life":[0.4,3.0],"flairColorMode":"random"},
      "flair":{"enabled":true},
      "crackle":{"enabled":false,"probability":0,"sound":"crackle"},
      "sound":{"boom":"light"},"mortar":{"smokeParticles":60,"sound":true}}'::jsonb)
on conflict (slug) do update set
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
