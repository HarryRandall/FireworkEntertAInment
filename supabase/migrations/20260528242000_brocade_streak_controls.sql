-- Give Brocade explicit streak controls with a longer default wake.

update public.firework_effects
set
  model_json = jsonb_set(
    jsonb_set(
      model_json,
      '{renderDefaults,trail,streakSize}',
      '1.2'::jsonb
    ),
    '{renderDefaults,trail,streakLength}',
    '2.2'::jsonb
  ),
  updated_at = now()
where slug = 'brocade';
