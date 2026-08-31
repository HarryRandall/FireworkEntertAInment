-- Upgrade legacy spark/streak/brocade trail settings into the unified
-- burstTrail renderer model. This is a data-only migration: no table shape or
-- generated TypeScript database types change.

create or replace function public._showcrafter_burst_trail_preset(model jsonb)
returns text
language sql
immutable
as $$
  select case
    when coalesce(model #>> '{renderDefaults,flair,enabled}', model #>> '{flair,enabled}') = 'false'
      then 'none'
    when coalesce(model #>> '{renderDefaults,trailProfile}', model ->> 'trailProfile') = 'none'
      then 'none'
    when coalesce(model #>> '{renderDefaults,stars,trail,mode}', model #>> '{stars,trail,mode}') = 'none'
      then 'none'
    when coalesce(model #>> '{renderDefaults,geometry}', model ->> 'geometry') = 'crown'
      and coalesce(model #>> '{renderDefaults,trailProfile}', model ->> 'trailProfile') = 'glitter'
      then 'denseBrocade'
    when coalesce(model #>> '{renderDefaults,geometry}', model ->> 'geometry') in ('weeping', 'falling_tail', 'waterfall')
      or coalesce(model #>> '{renderDefaults,trailProfile}', model ->> 'trailProfile') in ('long_hang', 'waterfall')
      then 'willowHang'
    when coalesce(model #>> '{renderDefaults,geometry}', model ->> 'geometry') = 'single_tail'
      or coalesce(model #>> '{renderDefaults,trailProfile}', model ->> 'trailProfile') = 'thick_tail'
      then 'cometTail'
    when coalesce(model #>> '{renderDefaults,stars,trail,mode}', model #>> '{stars,trail,mode}') = 'spark'
      then 'sparkDust'
    else 'solidStreaks'
  end
$$;

create or replace function public._showcrafter_burst_trail_default(preset text)
returns jsonb
language sql
immutable
as $$
  select case preset
    when 'none' then jsonb_build_object(
      'version', 2, 'enabled', false, 'preset', 'none', 'colourMode', 'gold',
      'particlesPerStar', 0, 'frontClump', 0,
      'width', jsonb_build_object('front', 0, 'tail', 0, 'curve', 1),
      'lifetime', jsonb_build_object('baseSeconds', 0.4, 'variationPercent', 20, 'afterglowSeconds', 0),
      'intensity', jsonb_build_object('brightness', 0, 'fadeSoftness', 1),
      'flicker', jsonb_build_object('chance', 0, 'strength', 0, 'lifetimeMultiplier', 0.45),
      'motion', jsonb_build_object('gravity', -0.014, 'drag', 1.6, 'inheritedVelocity', 0, 'turbulence', 0, 'driftX', 0, 'driftY', -0.012, 'driftZ', 0, 'spin', 0),
      'stops', jsonb_build_array(
        jsonb_build_object('position', 0, 'density', 0, 'size', 0.6, 'sizeVariation', 0, 'shapeWeights', jsonb_build_object('circle', 0, 'square', 100, 'triangle', 0)),
        jsonb_build_object('position', 100, 'density', 0, 'size', 0.4, 'sizeVariation', 0, 'shapeWeights', jsonb_build_object('circle', 0, 'square', 100, 'triangle', 0))
      )
    )
    when 'sparkDust' then jsonb_build_object(
      'version', 2, 'enabled', true, 'preset', 'sparkDust', 'colourMode', 'star',
      'particlesPerStar', 24, 'frontClump', 0.35,
      'width', jsonb_build_object('front', 1.1, 'tail', 2.1, 'curve', 1.15),
      'lifetime', jsonb_build_object('baseSeconds', 0.82, 'variationPercent', 55, 'afterglowSeconds', 0.3),
      'intensity', jsonb_build_object('brightness', 0.72, 'fadeSoftness', 1.3),
      'flicker', jsonb_build_object('chance', 0.22, 'strength', 0.75, 'lifetimeMultiplier', 0.45),
      'motion', jsonb_build_object('gravity', -0.035, 'drag', 2.4, 'inheritedVelocity', 0.02, 'turbulence', 0.2, 'driftX', 0, 'driftY', -0.018, 'driftZ', 0, 'spin', 2.2),
      'stops', jsonb_build_array(
        jsonb_build_object('position', 0, 'density', 1.05, 'size', 0.74, 'sizeVariation', 55, 'shapeWeights', jsonb_build_object('circle', 76, 'square', 16, 'triangle', 8)),
        jsonb_build_object('position', 55, 'density', 0.55, 'size', 0.55, 'sizeVariation', 60, 'shapeWeights', jsonb_build_object('circle', 82, 'square', 12, 'triangle', 6)),
        jsonb_build_object('position', 100, 'density', 0.16, 'size', 0.32, 'sizeVariation', 70, 'shapeWeights', jsonb_build_object('circle', 90, 'square', 8, 'triangle', 2))
      )
    )
    when 'willowHang' then jsonb_build_object(
      'version', 2, 'enabled', true, 'preset', 'willowHang', 'colourMode', 'gold',
      'particlesPerStar', 72, 'frontClump', 0.46,
      'width', jsonb_build_object('front', 1.15, 'tail', 2.2, 'curve', 1.6),
      'lifetime', jsonb_build_object('baseSeconds', 2.25, 'variationPercent', 34, 'afterglowSeconds', 1.15),
      'intensity', jsonb_build_object('brightness', 0.9, 'fadeSoftness', 1.8),
      'flicker', jsonb_build_object('chance', 0.06, 'strength', 0.55, 'lifetimeMultiplier', 0.5),
      'motion', jsonb_build_object('gravity', -0.12, 'drag', 0.85, 'inheritedVelocity', 0.015, 'turbulence', 0.06, 'driftX', 0, 'driftY', -0.08, 'driftZ', 0, 'spin', 0.7),
      'stops', jsonb_build_array(
        jsonb_build_object('position', 0, 'density', 1.2, 'size', 0.86, 'sizeVariation', 30, 'shapeWeights', jsonb_build_object('circle', 8, 'square', 84, 'triangle', 8)),
        jsonb_build_object('position', 48, 'density', 0.88, 'size', 0.72, 'sizeVariation', 36, 'shapeWeights', jsonb_build_object('circle', 12, 'square', 78, 'triangle', 10)),
        jsonb_build_object('position', 100, 'density', 0.28, 'size', 0.38, 'sizeVariation', 42, 'shapeWeights', jsonb_build_object('circle', 22, 'square', 68, 'triangle', 10))
      )
    )
    when 'cometTail' then jsonb_build_object(
      'version', 2, 'enabled', true, 'preset', 'cometTail', 'colourMode', 'starFade',
      'particlesPerStar', 96, 'frontClump', 0.68,
      'width', jsonb_build_object('front', 2.6, 'tail', 0.8, 'curve', 0.72),
      'lifetime', jsonb_build_object('baseSeconds', 1.25, 'variationPercent', 24, 'afterglowSeconds', 0.55),
      'intensity', jsonb_build_object('brightness', 1.15, 'fadeSoftness', 0.9),
      'flicker', jsonb_build_object('chance', 0.04, 'strength', 0.65, 'lifetimeMultiplier', 0.45),
      'motion', jsonb_build_object('gravity', -0.028, 'drag', 1.3, 'inheritedVelocity', 0.04, 'turbulence', 0.05, 'driftX', 0, 'driftY', -0.018, 'driftZ', 0, 'spin', 1.1),
      'stops', jsonb_build_array(
        jsonb_build_object('position', 0, 'density', 1.65, 'size', 1.28, 'sizeVariation', 20, 'shapeWeights', jsonb_build_object('circle', 6, 'square', 84, 'triangle', 10)),
        jsonb_build_object('position', 42, 'density', 0.92, 'size', 0.86, 'sizeVariation', 24, 'shapeWeights', jsonb_build_object('circle', 8, 'square', 80, 'triangle', 12)),
        jsonb_build_object('position', 100, 'density', 0.22, 'size', 0.42, 'sizeVariation', 32, 'shapeWeights', jsonb_build_object('circle', 18, 'square', 72, 'triangle', 10))
      )
    )
    when 'denseBrocade' then jsonb_build_object(
      'version', 2, 'enabled', true, 'preset', 'denseBrocade', 'colourMode', 'gold',
      'particlesPerStar', 120, 'frontClump', 0.72,
      'width', jsonb_build_object('front', 3.2, 'tail', 2.7, 'curve', 0.86),
      'lifetime', jsonb_build_object('baseSeconds', 1.45, 'variationPercent', 22, 'afterglowSeconds', 0.8),
      'intensity', jsonb_build_object('brightness', 1.15, 'fadeSoftness', 1.1),
      'flicker', jsonb_build_object('chance', 0.1, 'strength', 0.95, 'lifetimeMultiplier', 0.45),
      'motion', jsonb_build_object('gravity', -0.014, 'drag', 1.6, 'inheritedVelocity', 0.018, 'turbulence', 0.05, 'driftX', 0, 'driftY', -0.012, 'driftZ', 0, 'spin', 1.4),
      'stops', jsonb_build_array(
        jsonb_build_object('position', 0, 'density', 1.85, 'size', 1.15, 'sizeVariation', 22, 'shapeWeights', jsonb_build_object('circle', 4, 'square', 88, 'triangle', 8)),
        jsonb_build_object('position', 25, 'density', 1.25, 'size', 0.92, 'sizeVariation', 24, 'shapeWeights', jsonb_build_object('circle', 5, 'square', 86, 'triangle', 9)),
        jsonb_build_object('position', 70, 'density', 0.62, 'size', 0.64, 'sizeVariation', 30, 'shapeWeights', jsonb_build_object('circle', 8, 'square', 82, 'triangle', 10)),
        jsonb_build_object('position', 100, 'density', 0.24, 'size', 0.42, 'sizeVariation', 36, 'shapeWeights', jsonb_build_object('circle', 14, 'square', 76, 'triangle', 10))
      )
    )
    else jsonb_build_object(
      'version', 2, 'enabled', true, 'preset', 'solidStreaks', 'colourMode', 'gold',
      'particlesPerStar', 84, 'frontClump', 0.55,
      'width', jsonb_build_object('front', 1.35, 'tail', 1.35, 'curve', 1),
      'lifetime', jsonb_build_object('baseSeconds', 1, 'variationPercent', 28, 'afterglowSeconds', 0.45),
      'intensity', jsonb_build_object('brightness', 1, 'fadeSoftness', 1),
      'flicker', jsonb_build_object('chance', 0.08, 'strength', 0.9, 'lifetimeMultiplier', 0.45),
      'motion', jsonb_build_object('gravity', -0.014, 'drag', 1.6, 'inheritedVelocity', 0.02, 'turbulence', 0.045, 'driftX', 0, 'driftY', -0.012, 'driftZ', 0, 'spin', 1.3),
      'stops', jsonb_build_array(
        jsonb_build_object('position', 0, 'density', 1.45, 'size', 1, 'sizeVariation', 28, 'shapeWeights', jsonb_build_object('circle', 4, 'square', 88, 'triangle', 8)),
        jsonb_build_object('position', 32, 'density', 1.1, 'size', 0.86, 'sizeVariation', 30, 'shapeWeights', jsonb_build_object('circle', 5, 'square', 86, 'triangle', 9)),
        jsonb_build_object('position', 100, 'density', 0.32, 'size', 0.48, 'sizeVariation', 34, 'shapeWeights', jsonb_build_object('circle', 8, 'square', 84, 'triangle', 8))
      )
    )
  end
$$;

update public.firework_effects
set model_json = jsonb_set(
  model_json,
  '{renderDefaults,burstTrail}',
  public._showcrafter_burst_trail_default(public._showcrafter_burst_trail_preset(model_json)),
  true
);

update public.fireworks as fw
set render_overrides_json = jsonb_set(
  coalesce(fw.render_overrides_json, '{}'::jsonb),
  '{burstTrail}',
  public._showcrafter_burst_trail_default(public._showcrafter_burst_trail_preset(fe.model_json)),
  true
)
from public.firework_effects as fe
where fe.id = fw.firework_effect_id;

drop function public._showcrafter_burst_trail_default(text);
drop function public._showcrafter_burst_trail_preset(jsonb);
