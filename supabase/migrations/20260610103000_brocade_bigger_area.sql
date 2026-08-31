-- Brocade tuning: bigger explosion area via faster burst speed and more
-- streaks (renderer cap raised to 64). Squares got smaller and denser, heads
-- gained a dedicated large glow class, both renderer-side.

update public.firework_effects
set
  model_json = jsonb_set(
    jsonb_set(
      model_json,
      '{renderDefaults,burst,speed}',
      jsonb_build_array(2.6, 3.4)
    ),
    '{renderDefaults,size}',
    '60'::jsonb
  ),
  updated_at = now()
where slug = 'brocade';

update public.firework_variants
set
  variant_json = variant_json || jsonb_build_object('starCount', 60),
  updated_at = now()
where slug = 'brocade-default';
