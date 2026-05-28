-- Keep Brocade within the renderer schema so the admin preview does not fall
-- back to the default cyan sphere.

update public.firework_effects
set
  model_json = jsonb_set(
    model_json,
    '{renderDefaults,trail,density}',
    '3.95'::jsonb
  ),
  updated_at = now()
where slug = 'brocade';
