-- Brocade visual feedback round: fuller sphere with more streaks (renderer
-- cap raised to 32) and shorter star life so the following tail does not
-- linger. Trail squares themselves were shortened in the renderer.

update public.firework_effects
set
  model_json = jsonb_set(
    jsonb_set(
      model_json,
      '{renderDefaults,size}',
      '32'::jsonb
    ),
    '{renderDefaults,burst,life}',
    jsonb_build_array(1.8, 2.6)
  ),
  updated_at = now()
where slug = 'brocade';

update public.firework_variants
set
  variant_json = variant_json || jsonb_build_object(
    'starCount', 32,
    'starLifeMs', 2400
  ),
  updated_at = now()
where slug = 'brocade-default';
