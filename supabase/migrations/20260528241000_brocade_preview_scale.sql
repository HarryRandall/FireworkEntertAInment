-- Scale Brocade back up after the filled 3D spread so the preview reads like
-- the white-gold exemplar rather than a distant compact dot.

update public.firework_effects
set
  model_json = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            model_json,
            '{renderDefaults,size}',
            '340'::jsonb
          ),
          '{renderDefaults,burst,speed}',
          '[3.2,5.2]'::jsonb
        ),
        '{renderDefaults,burst,gravity}',
        '[-0.78,-0.24]'::jsonb
      ),
      '{renderDefaults,burst,life}',
      '[1.05,4.25]'::jsonb
    ),
    '{renderDefaults,trail}',
    '{"density":4.05,"length":2.15,"sparkle":0.5,"thickness":0.72}'::jsonb
  ),
  updated_at = now()
where slug = 'brocade';

update public.firework_variants
set
  variant_json = variant_json || jsonb_build_object(
    'spreadSize', 5.7,
    'starLifeMs', 2800,
    'glitter', 'heavy'
  ),
  updated_at = now()
where slug = 'brocade-default';
