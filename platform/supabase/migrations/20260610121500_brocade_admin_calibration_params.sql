-- Promote the brocade renderer's hard-coded calibration constants into
-- model_json so the admin effects page can tune them live. Values mirror the
-- constants the brocade rework shipped with (BROCADE_TRAIL_STEP,
-- BROCADE_TUBE_RADIUS, head size 900, 50/50 green/red split, hot-to-ember
-- trail palette in platform/lib/fireworks/Effects.ts). `streakCount` takes
-- over from `size` as the explicit streak-head count.

update public.firework_effects
set
  model_json = jsonb_set(
    model_json,
    '{renderDefaults,brocade}',
    jsonb_build_object(
      'streakCount', 60,
      'trailStep', 3.0,
      'tubeRadius', 3.2,
      'headSize', 900,
      'glowStrength', 1,
      'greenRatio', 0.5,
      'headColors', jsonb_build_object(
        'green', jsonb_build_object('r', 0.4, 'g', 1, 'b', 0.5),
        'red', jsonb_build_object('r', 1, 'g', 0.28, 'b', 0.32)
      ),
      'palette', jsonb_build_object(
        'hot', jsonb_build_object('r', 1, 'g', 0.93, 'b', 0.72),
        'ember', jsonb_build_object('r', 1, 'g', 0.42, 'b', 0.14)
      )
    ),
    true
  ),
  updated_at = now()
where slug = 'brocade';
