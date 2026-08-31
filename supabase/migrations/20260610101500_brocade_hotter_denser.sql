-- Brocade tuning: more streaks for a fuller burst (renderer cap raised to
-- 48). Heads gained a co-moving glow companion and the trail gradient now
-- runs white-gold hot at the centre cooling to ember, both renderer-side.

update public.firework_effects
set
  model_json = jsonb_set(
    model_json,
    '{renderDefaults,size}',
    '44'::jsonb
  ),
  updated_at = now()
where slug = 'brocade';

update public.firework_variants
set
  variant_json = variant_json || jsonb_build_object('starCount', 44),
  updated_at = now()
where slug = 'brocade-default';
