-- Keep the corrected circular Brocade shape visible in the preview without
-- returning to the previous rectangular bloom.

update public.firework_effects
set
  model_json = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            model_json,
            '{renderDefaults,size}',
            '280'::jsonb
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
    '{"density":3.35,"length":2.05,"sparkle":0.58,"thickness":0.72}'::jsonb
  ),
  updated_at = now()
where slug = 'brocade';

update public.firework_variants
set
  variant_json = variant_json || jsonb_build_object(
    'spreadSize', 5.6,
    'starLifeMs', 2700
  ),
  updated_at = now()
where slug = 'brocade-default';
