-- Promote the calibrated square-trail look into base effect defaults. Non-custom
-- firework trail overrides are removed so products inherit the refreshed effect
-- default, while explicit custom firework trail edits are preserved.

with calibrated_trail(defaults) as (
  values (
    jsonb_build_object(
      'version', 2,
      'enabled', true,
      'preset', 'custom',
      'colourMode', 'starFade',
      'particlesPerStar', 178,
      'frontClump', 0.55,
      'width', jsonb_build_object('front', 20, 'tail', 0, 'curve', 1),
      'particleSize', jsonb_build_object(
        'base', 1.2,
        'headScale', 1,
        'tailScale', 0.35,
        'variationPercent', 8
      ),
      'placement', jsonb_build_object('headGapPercent', 60),
      'spacing', jsonb_build_object(
        'curve', 1,
        'jitterPercent', 18
      ),
      'lifetime', jsonb_build_object(
        'mode', 'dynamic',
        'percent', 18,
        'baseSeconds', 8,
        'variationPercent', 30,
        'afterglowSeconds', 0.15
      ),
      'intensity', jsonb_build_object('brightness', 1, 'fadeSoftness', 1),
      'flicker', jsonb_build_object(
        'chance', 0.08,
        'strength', 0.8,
        'lifetimeMultiplier', 0.45
      ),
      'motion', jsonb_build_object(
        'gravity', -0.014,
        'drag', 1.6,
        'inheritedVelocity', 0.02,
        'turbulence', 0.045,
        'driftX', 0,
        'driftY', -0.012,
        'driftZ', 0,
        'spin', 0
      ),
      'stops', jsonb_build_array(
        jsonb_build_object(
          'position', 0,
          'density', 1,
          'size', 2.68,
          'sizeVariation', 0,
          'shapeWeights', jsonb_build_object('circle', 0, 'square', 100, 'triangle', 0)
        ),
        jsonb_build_object(
          'position', 100,
          'density', 1,
          'size', 0.08,
          'sizeVariation', 0,
          'shapeWeights', jsonb_build_object('circle', 0, 'square', 100, 'triangle', 0)
        )
      )
    )
  )
)
update public.firework_effects
set model_json =
  coalesce(model_json, '{}'::jsonb) ||
  jsonb_build_object(
    'renderDefaults',
    coalesce(model_json -> 'renderDefaults', '{}'::jsonb) ||
    jsonb_build_object('burstTrail', calibrated_trail.defaults)
  )
from calibrated_trail
where coalesce(model_json #>> '{renderDefaults,burstTrail,enabled}', 'true') <> 'false'
  and (
    model_json #> '{renderDefaults,burstTrail}' is not null
    or coalesce(model_json #>> '{renderDefaults,trailProfile}', model_json ->> 'trailProfile') is not null
  )
  and coalesce(model_json #>> '{renderDefaults,trailProfile}', model_json ->> 'trailProfile', '') <> 'none'
  and coalesce(model_json #>> '{renderDefaults,flair,enabled}', model_json #>> '{flair,enabled}', 'true') <> 'false';

update public.fireworks
set render_overrides_json = coalesce(render_overrides_json, '{}'::jsonb) - 'burstTrail'
where coalesce(render_overrides_json, '{}'::jsonb) ? 'burstTrail'
  and coalesce(render_overrides_json #>> '{burstTrail,preset}', '') <> 'custom';
