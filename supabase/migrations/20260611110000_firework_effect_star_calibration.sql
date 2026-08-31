-- Calibrate every reference base effect for the shared star-head and trail
-- renderer. Without these saved model_json blocks, existing products can still
-- compile through the old spark-dust defaults even though the renderer knows
-- how to draw the new look.

with calibrations(slug, stars, duration_seconds) as (
  values
    (
      'peony',
      '{"heads":{"enabled":true,"size":220,"glowStrength":0.55},"trail":{"mode":"none","step":3.2,"tubeRadius":1.6,"squareSize":0.8,"lifeSeconds":0.9,"colorMode":"gold","flicker":0}}'::jsonb,
      7.3::numeric
    ),
    (
      'chrysanthemum',
      '{"heads":{"enabled":true,"size":240,"glowStrength":0.7},"trail":{"mode":"streak","step":3,"tubeRadius":1.6,"squareSize":0.7,"lifeSeconds":0.9,"colorMode":"gold","flicker":0.12}}'::jsonb,
      7.9::numeric
    ),
    (
      'brocade',
      '{"heads":{"enabled":true,"size":900,"glowStrength":1},"trail":{"mode":"streak","step":3,"tubeRadius":3.2,"squareSize":1,"lifeSeconds":1.5,"colorMode":"gold","flicker":0}}'::jsonb,
      6.1::numeric
    ),
    (
      'willow',
      '{"heads":{"enabled":true,"size":190,"glowStrength":0.45},"trail":{"mode":"streak","step":2.6,"tubeRadius":1.5,"squareSize":0.65,"lifeSeconds":2.3,"colorMode":"gold","flicker":0.06}}'::jsonb,
      15.1::numeric
    ),
    (
      'palm',
      '{"heads":{"enabled":true,"size":620,"glowStrength":1.1},"trail":{"mode":"streak","step":2.4,"tubeRadius":3.4,"squareSize":1.15,"lifeSeconds":1.2,"colorMode":"gold","flicker":0}}'::jsonb,
      8.5::numeric
    ),
    (
      'ring',
      '{"heads":{"enabled":true,"size":260,"glowStrength":0.85},"trail":{"mode":"none","step":3.2,"tubeRadius":1.6,"squareSize":0.8,"lifeSeconds":0.9,"colorMode":"gold","flicker":0}}'::jsonb,
      6.8::numeric
    ),
    (
      'crossette',
      '{"heads":{"enabled":true,"size":320,"glowStrength":0.8},"trail":{"mode":"streak","step":2.8,"tubeRadius":1.6,"squareSize":0.75,"lifeSeconds":0.7,"colorMode":"starFade","flicker":0}}'::jsonb,
      7.4::numeric
    ),
    (
      'horsetail',
      '{"heads":{"enabled":true,"size":340,"glowStrength":0.8},"trail":{"mode":"streak","step":2.2,"tubeRadius":2.4,"squareSize":0.9,"lifeSeconds":1.8,"colorMode":"gold","flicker":0.05}}'::jsonb,
      13.8::numeric
    ),
    (
      'comet',
      '{"heads":{"enabled":true,"size":900,"glowStrength":1.2},"trail":{"mode":"streak","step":2,"tubeRadius":3,"squareSize":1.1,"lifeSeconds":1.3,"colorMode":"gold","flicker":0}}'::jsonb,
      5.9::numeric
    ),
    (
      'mine',
      '{"heads":{"enabled":true,"size":200,"glowStrength":0.65},"trail":{"mode":"streak","step":2.8,"tubeRadius":1.6,"squareSize":0.6,"lifeSeconds":0.5,"colorMode":"starFade","flicker":0}}'::jsonb,
      4.9::numeric
    ),
    (
      'strobe',
      '{"heads":{"enabled":true,"size":240,"glowStrength":0.9},"trail":{"mode":"none","step":3.2,"tubeRadius":1.6,"squareSize":0.8,"lifeSeconds":0.9,"colorMode":"gold","flicker":0}}'::jsonb,
      7.5::numeric
    ),
    (
      'crackle',
      '{"heads":{"enabled":true,"size":120,"glowStrength":0.6},"trail":{"mode":"none","step":3.2,"tubeRadius":1.6,"squareSize":0.8,"lifeSeconds":0.9,"colorMode":"gold","flicker":0}}'::jsonb,
      7.0::numeric
    ),
    (
      'pistil',
      '{"heads":{"enabled":true,"size":230,"glowStrength":0.7},"trail":{"mode":"streak","step":3.2,"tubeRadius":1.4,"squareSize":0.65,"lifeSeconds":0.7,"colorMode":"star","flicker":0}}'::jsonb,
      7.5::numeric
    ),
    (
      'pearls',
      '{"heads":{"enabled":true,"size":430,"glowStrength":1},"trail":{"mode":"none","step":3.2,"tubeRadius":1.6,"squareSize":0.8,"lifeSeconds":0.9,"colorMode":"gold","flicker":0}}'::jsonb,
      5.7::numeric
    ),
    (
      'tail',
      '{"heads":{"enabled":true,"size":900,"glowStrength":1.2},"trail":{"mode":"streak","step":2,"tubeRadius":3,"squareSize":1.1,"lifeSeconds":1.3,"colorMode":"gold","flicker":0}}'::jsonb,
      5.7::numeric
    ),
    (
      'silver-fish',
      '{"heads":{"enabled":true,"size":170,"glowStrength":0.7},"trail":{"mode":"streak","step":2.4,"tubeRadius":1,"squareSize":0.55,"lifeSeconds":0.5,"colorMode":"silver","flicker":0}}'::jsonb,
      5.3::numeric
    ),
    (
      'waterfall',
      '{"heads":{"enabled":true,"size":200,"glowStrength":0.55},"trail":{"mode":"streak","step":2,"tubeRadius":1.6,"squareSize":0.7,"lifeSeconds":2.6,"colorMode":"silver","flicker":0}}'::jsonb,
      14.6::numeric
    ),
    (
      'whirl',
      '{"heads":{"enabled":true,"size":220,"glowStrength":0.9},"trail":{"mode":"streak","step":2.6,"tubeRadius":1.2,"squareSize":0.6,"lifeSeconds":0.7,"colorMode":"silver","flicker":0}}'::jsonb,
      5.8::numeric
    )
)
update public.firework_effects as fe
set
  model_json = jsonb_set(
    jsonb_set(fe.model_json, '{version}', '5'::jsonb, true),
    '{renderDefaults}',
    coalesce(fe.model_json -> 'renderDefaults', '{}'::jsonb)
      || jsonb_build_object('stars', c.stars),
    true
  ),
  updated_at = now()
from calibrations as c
where fe.slug = c.slug;

-- Keep the brocade-specific editor switch explicit in saved data. The brocade
-- renderer reads this block rather than the shared stars block above.
update public.firework_effects
set
  model_json = jsonb_set(model_json, '{renderDefaults,brocade,headsEnabled}', 'true'::jsonb, true),
  updated_at = now()
where slug = 'brocade';

-- Strobe is visually a blinking star effect, so persist the strobe timing
-- defaults rather than relying on the trailProfile fallback alone.
update public.firework_effects
set
  model_json = jsonb_set(
    model_json,
    '{renderDefaults,strobe}',
    '{"enabled":true,"frequencyHz":14,"dutyCycle":0.42}'::jsonb,
    true
  ),
  updated_at = now()
where slug = 'strobe';

with calibrations(slug, duration_seconds) as (
  values
    ('peony', 7.3::numeric),
    ('chrysanthemum', 7.9::numeric),
    ('brocade', 6.1::numeric),
    ('willow', 15.1::numeric),
    ('palm', 8.5::numeric),
    ('ring', 6.8::numeric),
    ('crossette', 7.4::numeric),
    ('horsetail', 13.8::numeric),
    ('comet', 5.9::numeric),
    ('mine', 4.9::numeric),
    ('strobe', 7.5::numeric),
    ('crackle', 7.0::numeric),
    ('pistil', 7.5::numeric),
    ('pearls', 5.7::numeric),
    ('tail', 5.7::numeric),
    ('silver-fish', 5.3::numeric),
    ('waterfall', 14.6::numeric),
    ('whirl', 5.8::numeric)
)
update public.firework_variants as fv
set
  duration_seconds = c.duration_seconds,
  updated_at = now()
from calibrations as c
join public.firework_effects as fe on fe.slug = c.slug
where fv.effect_id = fe.id
  and fv.slug = fe.slug || '-default';
