-- Brocade tuning: longer overall life so the burst hangs in the sky a bit
-- more, with renderer-side changes syncing the trail fade to the heads and
-- keeping the burst centre clear of stacked squares.

update public.firework_effects
set
  model_json = jsonb_set(
    model_json,
    '{renderDefaults,burst,life}',
    jsonb_build_array(2.6, 3.8)
  ),
  updated_at = now()
where slug = 'brocade';

update public.firework_variants
set
  variant_json = variant_json || jsonb_build_object('starLifeMs', 3600),
  updated_at = now()
where slug = 'brocade-default';
