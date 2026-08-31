-- Fill Brocade into a white-gold circle and make the long wake read as
-- streaking trails behind the moving heads.

update public.firework_effects
set
  model_json = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            model_json,
            '{renderDefaults,size}',
            '300'::jsonb
          ),
          '{renderDefaults,burst,speed}',
          '[2.85,4.75]'::jsonb
        ),
        '{renderDefaults,burst,gravity}',
        '[-0.76,-0.22]'::jsonb
      ),
      '{renderDefaults,burst,life}',
      '[0.98,3.95]'::jsonb
    ),
    '{renderDefaults,trail}',
    '{"density":3.85,"length":2.05,"sparkle":0.5,"thickness":0.68}'::jsonb
  ),
  updated_at = now()
where slug = 'brocade';

update public.firework_variants
set
  variant_json = variant_json || jsonb_build_object(
    'spreadSize', 5.25,
    'starLifeMs', 2600,
    'glitter', 'heavy'
  ),
  updated_at = now()
where slug = 'brocade-default';
