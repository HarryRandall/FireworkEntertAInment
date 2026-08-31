update public.firework_style_defaults
set
  defaults_json = '{
    "liftVelocity": 20,
    "launch": {
      "shell": {
        "visible": true,
        "shape": "circle",
        "colour": { "r": 1, "g": 0.98, "b": 0.94 },
        "sizeScale": 1.1,
        "brightness": 1.35,
        "glowStrength": 1.1,
        "trail": {
          "tubeDiameter": 90,
          "frontAngle": 40,
          "tailAngle": 58,
          "curve": 0.8
        }
      },
      "liftParticles": {
        "enabled": true,
        "amount": 660,
        "height": 94,
        "colour": { "r": 1, "g": 0.78, "b": 0.46 },
        "shapeWeights": { "circle": 10, "square": 90, "triangle": 0 },
        "particleSize": {
          "base": 12,
          "headScale": 1.05,
          "tailScale": 0.2,
          "variationPercent": 72
        },
        "frontClump": 0.56,
        "spacing": {
          "curve": 1.1,
          "jitterPercent": 72,
          "clusterStrength": 36,
          "pathSamples": 12
        },
        "lifetime": {
          "baseSeconds": 0.82,
          "variationPercent": 56,
          "afterglowSeconds": 0.08
        },
        "intensity": {
          "brightness": 1.85,
          "fadeSoftness": 0.68
        },
        "flicker": {
          "chance": 0.14,
          "strength": 1.05,
          "lifetimeMultiplier": 0.45
        },
        "motion": {
          "gravity": -0.08,
          "drag": 2.35,
          "inheritedVelocity": 0.04,
          "turbulence": 0.34,
          "driftX": 0.02,
          "driftY": -0.04,
          "driftZ": 0,
          "spin": 0,
          "swirlStrength": 3.2,
          "swirlRadius": 96,
          "swirlLoopCount": 2.3,
          "swirlLoopLength": 74,
          "swirlLoopHeight": 126,
          "swirlRate": 0.22
        }
      }
    }
  }'::jsonb,
  updated_at = now()
where slug = 'standard-launch'
  and kind = 'launch';
