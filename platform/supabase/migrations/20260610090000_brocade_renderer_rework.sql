-- Rework Brocade for the new crown renderer: up to 20 seed-deterministic
-- streaks with green or red circular heads, square peach trail particles laid
-- along each head's trajectory, and a rich orange/red core flash at burst.
-- The renderer caps brocade streak count at 20 (BROCADE_MAX_STREAKS in
-- platform/lib/fireworks/Effects.ts); `size` here drives that count directly.

update public.firework_effects
set
  description = 'Crown brocade with up to 20 streaks, green or red heads, square peach trails along each arc, and a rich orange burst core.',
  model_json = jsonb_build_object(
    'version', 4,
    'geometry', 'crown',
    'trailProfile', 'glitter',
    'renderDefaults', jsonb_build_object(
      'pattern', 'wave',
      'geometry', 'crown',
      'trailProfile', 'glitter',
      'size', 20,
      'color', jsonb_build_object('r', 1, 'g', 0.45, 'b', 0.12),
      'secondaryColor', jsonb_build_object('r', 1, 'g', 0.85, 'b', 0.62),
      'liftVelocity', 12.6,
      'burst', jsonb_build_object(
        'speed', jsonb_build_array(1.7, 2.4),
        'gravity', jsonb_build_array(-0.6, -0.36),
        'life', jsonb_build_array(2.4, 3.6),
        'flairColorMode', 'bombColor'
      ),
      'trail', jsonb_build_object(
        'density', 1,
        'length', 1,
        'sparkle', 0,
        'thickness', 1,
        'streakSize', 1,
        'streakLength', 1,
        'streakLife', 1
      ),
      'flair', jsonb_build_object('enabled', true),
      'crackle', jsonb_build_object(
        'enabled', false,
        'probability', 0,
        'sound', 'crackle'
      ),
      'sound', jsonb_build_object('boom', 'light'),
      'mortar', jsonb_build_object('sound', true, 'smokeParticles', 70)
    )
  ),
  updated_at = now()
where slug = 'brocade';

update public.firework_variants
set
  primary_color = '#ff8c33',
  secondary_color = '#ffd9a8',
  color_palette = array['#ff8c33', '#ffd9a8', '#39e75f', '#ff4040'],
  variant_json = variant_json || jsonb_build_object(
    'shellType', 'brocade',
    'color', '#ff8c33',
    'outerColor', '#ff8c33',
    'innerColor', '#ffd9a8',
    'glitter', 'heavy',
    'glitterColor', '#ffd9a8',
    'starCount', 20,
    'starLifeMs', 3200
  ),
  updated_at = now()
where slug = 'brocade-default';
