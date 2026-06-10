-- Brocade tuning: roughly double the burst scale. Faster burst speed (kept
-- under the engine's lateral velocity clamp) pairs with lower star drag
-- renderer-side, so the sphere reads clearly from far away.

update public.firework_effects
set
  model_json = jsonb_set(
    model_json,
    '{renderDefaults,burst,speed}',
    jsonb_build_array(4.2, 5.4)
  ),
  updated_at = now()
where slug = 'brocade';
