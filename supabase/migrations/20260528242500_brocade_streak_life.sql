-- Add a separate life control for Brocade streak particles.

update public.firework_effects
set
  model_json = jsonb_set(
    model_json,
    '{renderDefaults,trail,streakLife}',
    '1.35'::jsonb
  ),
  updated_at = now()
where slug = 'brocade';
