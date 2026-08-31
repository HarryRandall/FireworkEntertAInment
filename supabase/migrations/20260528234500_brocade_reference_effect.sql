-- Tune Brocade to match the Keystone-style white-gold reference:
-- a hot lift streak, compact amber burst haze, and long falling brocade trails.

update public.firework_effects
set
  description = 'White-gold crown with a hot lift streak, amber burst haze, and long falling brocade trails.',
  model_json = jsonb_build_object(
    'version', 3,
    'geometry', 'crown',
    'trailProfile', 'glitter',
    'renderDefaults', jsonb_build_object(
      'pattern', 'wave',
      'geometry', 'crown',
      'trailProfile', 'glitter',
      'size', 270,
      'color', jsonb_build_object('r', 1, 'g', 0.82, 'b', 0.36),
      'secondaryColor', jsonb_build_object('r', 1, 'g', 0.98, 'b', 0.88),
      'liftVelocity', 12.6,
      'burst', jsonb_build_object(
        'speed', jsonb_build_array(1.45, 2.85),
        'gravity', jsonb_build_array(-0.82, -0.34),
        'life', jsonb_build_array(1.15, 4.95),
        'flairColorMode', 'bombColor'
      ),
      'trail', jsonb_build_object(
        'density', 2.85,
        'length', 2.35,
        'sparkle', 0.62,
        'thickness', 0.86
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
  primary_color = '#ffd166',
  secondary_color = '#fff7de',
  color_palette = array['#ffd166', '#fff7de', '#9c5a17'],
  variant_json = variant_json || jsonb_build_object(
    'shellType', 'brocade',
    'color', '#ffd166',
    'outerColor', '#ffd166',
    'innerColor', '#fff7de',
    'glitter', 'heavy',
    'glitterColor', '#fff7de',
    'starLifeMs', 3000
  ),
  updated_at = now()
where slug = 'brocade-default';
