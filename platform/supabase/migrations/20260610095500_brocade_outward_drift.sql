-- Brocade tuning: push streaks outward rather than letting them fall.
-- Slightly faster burst, much weaker gravity, and a touch more star life so
-- the spherical structure holds while the longer tails play out.

update public.firework_effects
set
  model_json = jsonb_set(
    jsonb_set(
      jsonb_set(
        model_json,
        '{renderDefaults,burst,speed}',
        jsonb_build_array(1.9, 2.6)
      ),
      '{renderDefaults,burst,gravity}',
      jsonb_build_array(-0.28, -0.14)
    ),
    '{renderDefaults,burst,life}',
    jsonb_build_array(2.0, 3.0)
  ),
  updated_at = now()
where slug = 'brocade';

update public.firework_variants
set
  variant_json = variant_json || jsonb_build_object('starLifeMs', 2800),
  updated_at = now()
where slug = 'brocade-default';
