-- Promote the calibrated Blue Sphere-inspired star-head look into base effect
-- settings. Product-level overrides are then cleaned up so existing fireworks
-- inherit these editable defaults instead of pinning the old appearance tuning.

with calibrated_heads(defaults) as (
  values (
    jsonb_build_object(
      'glowStrength', 1.5,
      'glowPadding', 150,
      'whiteCoreSizePercent', 20,
      'whiteCoreBlurPercent', 15,
      'coreSoftness', 55,
      'coreBrightness', 50,
      'coreOpacityFalloff', 60,
      'glowSize', 90,
      'glowSoftness', 100,
      'glowOpacityFalloff', 100,
      'glowBlur', 45,
      'backgroundGlowOpacityFalloff', 75,
      'backgroundGlowSoftness', 50
    )
  )
)
update public.firework_effects
set model_json =
  coalesce(model_json, '{}'::jsonb) ||
  jsonb_build_object(
    'renderDefaults',
    coalesce(model_json -> 'renderDefaults', '{}'::jsonb) ||
    jsonb_build_object(
      'stars',
      coalesce(model_json #> '{renderDefaults,stars}', '{}'::jsonb) ||
      jsonb_build_object(
        'heads',
        coalesce(model_json #> '{renderDefaults,stars,heads}', '{}'::jsonb) ||
        calibrated_heads.defaults
      )
    )
  )
from calibrated_heads;

update public.firework_effects
set model_json =
  coalesce(model_json, '{}'::jsonb) ||
  jsonb_build_object(
    'renderDefaults',
    coalesce(model_json -> 'renderDefaults', '{}'::jsonb) ||
    jsonb_build_object(
      'brocade',
      coalesce(model_json #> '{renderDefaults,brocade}', '{}'::jsonb) ||
      jsonb_build_object('glowStrength', 1.5)
    )
  )
where model_json #> '{renderDefaults,brocade}' is not null;

update public.fireworks
set render_overrides_json = jsonb_set(
  render_overrides_json,
  '{stars,heads}',
  (render_overrides_json #> '{stars,heads}')
    - 'glowStrength'
    - 'glowPadding'
    - 'whiteCoreSizePercent'
    - 'whiteCoreBlurPercent'
    - 'coreSoftness'
    - 'coreBrightness'
    - 'coreOpacityFalloff'
    - 'glowSize'
    - 'glowSoftness'
    - 'glowOpacityFalloff'
    - 'glowBlur'
    - 'backgroundGlowOpacityFalloff'
    - 'backgroundGlowSoftness',
  true
)
where render_overrides_json #> '{stars,heads}' is not null;

update public.fireworks
set render_overrides_json = jsonb_set(
  render_overrides_json,
  '{brocade}',
  (render_overrides_json #> '{brocade}') - 'glowStrength',
  true
)
where render_overrides_json #> '{brocade}' is not null;
