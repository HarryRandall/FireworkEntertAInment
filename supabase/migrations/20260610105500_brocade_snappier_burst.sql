-- Brocade tuning: snappier expansion. Faster burst speed paired with higher
-- star drag (renderer-side) so streaks shoot out quickly then brake, keeping
-- a similar final spread.

update public.firework_effects
set
  model_json = jsonb_set(
    model_json,
    '{renderDefaults,burst,speed}',
    jsonb_build_array(3.2, 4.2)
  ),
  updated_at = now()
where slug = 'brocade';
