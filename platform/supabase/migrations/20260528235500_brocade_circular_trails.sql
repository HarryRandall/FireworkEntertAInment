-- Refine Brocade into a circular white-gold crown with smaller round stars
-- and tapering trails rather than a flat glowing bar.

update public.firework_effects
set
  model_json = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            model_json,
            '{renderDefaults,size}',
            '210'::jsonb
          ),
          '{renderDefaults,burst,speed}',
          '[2.35,3.45]'::jsonb
        ),
        '{renderDefaults,burst,gravity}',
        '[-0.74,-0.28]'::jsonb
      ),
      '{renderDefaults,burst,life}',
      '[0.95,3.65]'::jsonb
    ),
    '{renderDefaults,trail}',
    '{"density":3.2,"length":1.85,"sparkle":0.58,"thickness":0.62}'::jsonb
  ),
  updated_at = now()
where slug = 'brocade';

update public.firework_variants
set
  variant_json = variant_json || jsonb_build_object(
    'shellType', 'brocade',
    'spreadSize', 4.4,
    'starLifeMs', 2300,
    'glitter', 'heavy'
  ),
  updated_at = now()
where slug = 'brocade-default';
