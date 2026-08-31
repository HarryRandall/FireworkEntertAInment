-- These presets are reusable renderer fragments. Keep the seed data-only so
-- catalogue fireworks and base effects remain explicit editor choices.
with seeded_defaults as (
  select *
  from jsonb_to_recordset($seed$
  [
    {
      "slug": "geometry-natural-sphere",
      "name": "Natural sphere",
      "description": "A balanced spherical burst with the current renderer's natural variation.",
      "kind": "geometry",
      "defaults_json": { "geometry": "sphere" },
      "sort_order": 200
    },
    {
      "slug": "geometry-clean-ring",
      "name": "Clean ring",
      "description": "A crisp tilted ring with restrained depth wobble and a long readable outline.",
      "kind": "geometry",
      "defaults_json": {
        "geometry": "ring",
        "geometryTuning": {
          "ring": {
            "countPercent": 76,
            "wobble": 0.12,
            "verticalSquash": 0.98,
            "tiltVariation": 0.75,
            "lifePercent": 92
          }
        }
      },
      "sort_order": 210
    },
    {
      "slug": "geometry-palm-crown",
      "name": "Palm crown",
      "description": "Strong rising fronds that open broadly before falling away.",
      "kind": "geometry",
      "defaults_json": {
        "geometry": "crown",
        "geometryTuning": {
          "crown": {
            "lift": 0.68,
            "liftVariation": 0.45,
            "spread": 0.82,
            "spreadVariation": 0.26
          }
        }
      },
      "sort_order": 220
    },
    {
      "slug": "geometry-weeping-willow",
      "name": "Weeping willow",
      "description": "Slow, wide fronds with a long hang and a deliberate downward pull.",
      "kind": "geometry",
      "defaults_json": {
        "geometry": "weeping",
        "geometryTuning": {
          "weeping": {
            "lift": 0.28,
            "liftVariation": 0.34,
            "spread": 0.76,
            "spreadVariation": 0.24,
            "lifePercent": 150,
            "gravityPercent": 40,
            "dragPercent": 50
          }
        }
      },
      "sort_order": 230
    },
    {
      "slug": "geometry-eight-arm-spider",
      "name": "Eight-arm spider",
      "description": "Eight defined radial arms with tight angular scatter and a broad reach.",
      "kind": "geometry",
      "defaults_json": {
        "geometry": "radial_arms",
        "geometryTuning": {
          "radialArms": {
            "arms": 8,
            "countPercent": 62,
            "angleJitter": 0.06,
            "armLength": 0.92,
            "lift": 0.1,
            "liftVariation": 0.25,
            "dragPercent": 70
          }
        }
      },
      "sort_order": 240
    },
    {
      "slug": "geometry-heart-outline",
      "name": "Heart outline",
      "description": "A front-facing heart outline with low depth scatter and a clean silhouette.",
      "kind": "geometry",
      "defaults_json": {
        "geometry": "heart",
        "geometryTuning": {
          "heart": {
            "countPercent": 92,
            "scaleX": 1,
            "scaleY": 1.05,
            "depthScale": 0.035,
            "outlineJitter": 0.018,
            "tiltVariation": 0.18,
            "rotationDegrees": 0
          }
        }
      },
      "sort_order": 250
    },
    {
      "slug": "geometry-five-point-star-outline",
      "name": "Five-point star outline",
      "description": "A sharp five-point star with a compact inner radius and low planar noise.",
      "kind": "geometry",
      "defaults_json": {
        "geometry": "five_point_star",
        "geometryTuning": {
          "fivePointStar": {
            "countPercent": 94,
            "points": 5,
            "innerRadius": 0.42,
            "scaleX": 1,
            "scaleY": 1.08,
            "depthScale": 0.035,
            "outlineJitter": 0.018,
            "tiltVariation": 0.18,
            "rotationDegrees": -90
          }
        }
      },
      "sort_order": 260
    },
    {
      "slug": "geometry-wide-bowtie",
      "name": "Wide bowtie",
      "description": "Two opposed fans forming a broad, flat figure-eight shell.",
      "kind": "geometry",
      "defaults_json": {
        "geometry": "bowtie",
        "geometryTuning": {
          "bowtie": {
            "countPercent": 88,
            "fanAngleDegrees": 126,
            "verticalScale": 0.3,
            "depthScale": 0.1,
            "lengthBase": 0.94,
            "lengthVariation": 0.14
          }
        }
      },
      "sort_order": 270
    },
    {
      "slug": "geometry-darting-fish-swarm",
      "name": "Darting fish swarm",
      "description": "A flattened school of bright stars with lively crossing movement.",
      "kind": "geometry",
      "defaults_json": {
        "geometry": "fish",
        "geometryTuning": {
          "fish": {
            "countPercent": 82,
            "verticalScale": 0.22,
            "lifeBaseSeconds": 1,
            "lifeVariationSeconds": 2.2,
            "wiggleStrength": 2.4,
            "wiggleRate": 13,
            "wiggleRateCross": 18,
            "gravityPercent": 48,
            "dragPercent": 50,
            "headSizePercent": 68,
            "trailLifePercent": 68
          }
        }
      },
      "sort_order": 280
    },
    {
      "slug": "geometry-wide-waterfall-curtain",
      "name": "Wide waterfall curtain",
      "description": "A broad elevated curtain that hangs before pouring towards the ground.",
      "kind": "geometry",
      "defaults_json": {
        "geometry": "waterfall",
        "geometryTuning": {
          "waterfall": {
            "countPercent": 94,
            "curtainWidth": 3.2,
            "scatterX": 34,
            "scatterZ": 18,
            "dropStart": 42,
            "fallSpeed": 0.8,
            "fallSpeedVariation": 1.1,
            "sideDrift": 0.18,
            "depthDrift": 0.12,
            "lifePercent": 160,
            "gravityBase": -0.27,
            "gravityVariation": 0.22,
            "dragPercent": 24,
            "headSizePercent": 70
          }
        }
      },
      "sort_order": 290
    },
    {
      "slug": "geometry-corkscrew-whirl",
      "name": "Corkscrew whirl",
      "description": "A compact spinning shower with strong corkscrew motion and a long visible turn.",
      "kind": "geometry",
      "defaults_json": {
        "geometry": "whirl",
        "geometryTuning": {
          "whirl": {
            "countPercent": 38,
            "minCount": 40,
            "verticalBias": -0.08,
            "spinStrength": 3.3,
            "spinRate": 15,
            "lifeBaseSeconds": 1.2,
            "lifeVariationSeconds": 2.4,
            "gravityPercent": 62,
            "dragPercent": 54,
            "headSizePercent": 82,
            "trailLifePercent": 82
          }
        }
      },
      "sort_order": 300
    },
    {
      "slug": "geometry-wide-mine-fan",
      "name": "Wide mine fan",
      "description": "A dense ground-origin fan with a wide opening and shallow depth.",
      "kind": "geometry",
      "defaults_json": {
        "geometry": "upward_fan",
        "geometryTuning": {
          "upwardFan": {
            "countPercent": 120,
            "minCount": 48,
            "spreadAngleDegrees": 190,
            "fanBase": 0.5,
            "fanVariation": 0.62,
            "spawnScatter": 26,
            "riseBase": 18,
            "riseVariation": 16,
            "riseSpeed": 1.35,
            "riseSpeedVariation": 0.65,
            "depthScale": 0.3,
            "lifePercent": 82,
            "dragPercent": 54,
            "headSizePercent": 78,
            "trailLifePercent": 72
          }
        }
      },
      "sort_order": 310
    },
    {
      "slug": "geometry-roman-candle-volley",
      "name": "Roman candle volley",
      "description": "A measured ground-launched sequence with controlled aim variation.",
      "kind": "geometry",
      "defaults_json": {
        "geometry": "roman_candle",
        "geometryTuning": {
          "romanCandle": {
            "shotsPercent": 12,
            "minShots": 6,
            "durationPercent": 52,
            "durationMinSeconds": 4,
            "durationMaxSeconds": 12,
            "spread": 0.42,
            "azimuth": 0.28,
            "speedBase": 1.05,
            "speedVariation": 0.24,
            "muzzleScatter": 8,
            "lateralScale": 0.2,
            "depthScale": 0.16,
            "riseBase": 1.15,
            "riseVariation": 0.24,
            "lifePercent": 96,
            "dragPercent": 62,
            "headSizePercent": 96,
            "trailLifePercent": 92
          }
        }
      },
      "sort_order": 320
    },
    {
      "slug": "geometry-tall-fountain",
      "name": "Tall fountain",
      "description": "A sustained narrow fountain with a tall, bright glitter cone.",
      "kind": "geometry",
      "defaults_json": {
        "geometry": "fountain",
        "geometryTuning": {
          "fountain": {
            "durationPercent": 42,
            "durationMinSeconds": 4,
            "durationMaxSeconds": 14,
            "ratePercent": 180,
            "minRatePerSecond": 60,
            "coneAngleDegrees": 38,
            "speedBase": 0.7,
            "speedVariation": 0.65,
            "spawnScatter": 7,
            "lateralScale": 0.42,
            "lifePercent": 72,
            "dragPercent": 105,
            "headSizePercent": 44,
            "trailLifePercent": 58
          }
        }
      },
      "sort_order": 330
    },
    {
      "slug": "star-natural-peony",
      "name": "Natural peony stars",
      "description": "A clean, fast peony with visible speed and lifetime variation.",
      "kind": "star",
      "defaults_json": {
        "stars": {
          "outer": {
            "enabled": true,
            "count": 100,
            "burst": {
              "speed": [2.4, 4.4],
              "gravity": [-0.28, -0.06],
              "life": [1.6, 3.6],
              "flairColorMode": "mixed"
            },
            "head": {
              "visible": true,
              "size": 330,
              "glowStrength": 1.55,
              "brightnessHoldPercent": 72,
              "brightnessHoldExponent": 1.05
            }
          },
          "core": { "enabled": false }
        }
      },
      "sort_order": 200
    },
    {
      "slug": "star-dense-chrysanthemum",
      "name": "Dense chrysanthemum stars",
      "description": "A full, slower-burning sphere with a bright middle life and smooth fade.",
      "kind": "star",
      "defaults_json": {
        "stars": {
          "outer": {
            "enabled": true,
            "count": 100,
            "burst": {
              "speed": [2.1, 3.8],
              "gravity": [-0.22, -0.04],
              "life": [2.8, 5.8],
              "flairColorMode": "mixed"
            },
            "head": {
              "visible": true,
              "size": 300,
              "glowStrength": 1.65,
              "brightnessHoldPercent": 76,
              "brightnessHoldExponent": 1.35,
              "closing": {
                "size": { "enabled": true, "endPercent": 0, "shrinkPercent": 30 }
              }
            }
          },
          "core": { "enabled": false }
        }
      },
      "sort_order": 210
    },
    {
      "slug": "star-long-hang-willow",
      "name": "Long-hang willow stars",
      "description": "Lower-energy stars with long burn times and a strong falling arc.",
      "kind": "star",
      "defaults_json": {
        "stars": {
          "outer": {
            "enabled": true,
            "count": 82,
            "burst": {
              "speed": [1.1, 2.4],
              "gravity": [-0.35, -0.14],
              "life": [4.2, 7.8],
              "flairColorMode": "bombColor"
            },
            "head": {
              "visible": true,
              "size": 250,
              "glowStrength": 1.4,
              "brightnessHoldPercent": 68,
              "brightnessHoldExponent": 0.72,
              "closing": {
                "size": { "enabled": true, "endPercent": 8, "shrinkPercent": 44 }
              }
            }
          },
          "core": { "enabled": false }
        }
      },
      "sort_order": 220
    },
    {
      "slug": "star-dual-pistil",
      "name": "Dual-layer pistil stars",
      "description": "A large outer break wrapped around a slower, compact inner pistil.",
      "kind": "star",
      "defaults_json": {
        "stars": {
          "outer": {
            "enabled": true,
            "count": 92,
            "burst": {
              "speed": [2.5, 4.1],
              "gravity": [-0.25, -0.05],
              "life": [2, 4.2],
              "flairColorMode": "bombColor"
            },
            "head": { "visible": true, "size": 310, "glowStrength": 1.6 }
          },
          "core": {
            "enabled": true,
            "count": 34,
            "burst": {
              "speed": [0.8, 1.6],
              "gravity": [-0.18, -0.04],
              "life": [2.4, 4.8],
              "flairColorMode": "mixed"
            },
            "head": { "visible": true, "size": 230, "glowStrength": 1.75 }
          }
        }
      },
      "sort_order": 230
    },
    {
      "slug": "star-ghost-colour-shift",
      "name": "Ghost colour-shift stars",
      "description": "Stars emerge cool and small, then fade towards a pale warm afterimage.",
      "kind": "star",
      "defaults_json": {
        "stars": {
          "outer": {
            "enabled": true,
            "count": 84,
            "burst": {
              "speed": [2, 3.6],
              "gravity": [-0.18, -0.04],
              "life": [2.8, 5],
              "flairColorMode": "bombColor"
            },
            "head": {
              "visible": true,
              "size": 290,
              "glowStrength": 1.75,
              "opening": {
                "colour": {
                  "enabled": true,
                  "color": { "r": 0.55, "g": 0.72, "b": 1 },
                  "fadePercent": 42
                },
                "size": { "enabled": true, "startPercent": 28, "growPercent": 25 }
              },
              "closing": {
                "colour": {
                  "enabled": true,
                  "color": { "r": 1, "g": 0.88, "b": 0.68 },
                  "fadePercent": 38
                },
                "size": { "enabled": true, "endPercent": 0, "shrinkPercent": 36 }
              },
              "brightnessHoldPercent": 58,
              "brightnessHoldExponent": 0.68
            }
          },
          "core": { "enabled": false }
        }
      },
      "sort_order": 240
    },
    {
      "slug": "trail-clean-stars",
      "name": "Clean stars",
      "description": "No persistent trail, leaving only the star heads and their natural fade.",
      "kind": "trail",
      "defaults_json": {
        "burstTrail": {
          "version": 2,
          "enabled": false,
          "preset": "none",
          "colourMode": "gold",
          "particlesPerStar": 0,
          "frontClump": 0,
          "width": { "front": 0, "tail": 0, "curve": 1 },
          "particleSize": { "base": 0.6, "headScale": 1, "tailScale": 0.6, "variationPercent": 0 },
          "opening": {
            "size": { "startPercent": 100 },
            "visibility": { "brightnessPercent": 100, "particlesPercent": 100, "revealPercent": 24 }
          },
          "closing": {
            "colour": { "enabled": false, "color": { "r": 1, "g": 0.34, "b": 0.08 }, "fadePercent": 22 },
            "size": { "enabled": false, "endPercent": 0, "shrinkPercent": 22 },
            "spreadFade": { "enabled": true, "startAngle": 60, "endOpacityPercent": 12 }
          },
          "placement": { "headGapPercent": 0 },
          "spacing": { "curve": 1, "jitterPercent": 0 },
          "lifetime": { "mode": "dynamic", "percent": 0.1, "baseSeconds": 0.4, "variationPercent": 20, "afterglowSeconds": 0 },
          "intensity": { "brightness": 0, "fadeSoftness": 1 },
          "flicker": { "chance": 0, "strength": 0, "lifetimeMultiplier": 0.45 },
          "motion": { "gravity": -0.014, "drag": 1.6, "inheritedVelocity": 0, "turbulence": 0, "driftX": 0, "driftY": -0.012, "driftZ": 0, "spin": 0 },
          "stops": [
            { "position": 0, "density": 0, "size": 0.6, "sizeVariation": 0, "shapeWeights": { "circle": 0, "square": 100, "triangle": 0 } },
            { "position": 100, "density": 0, "size": 0.4, "sizeVariation": 0, "shapeWeights": { "circle": 0, "square": 100, "triangle": 0 } }
          ]
        }
      },
      "sort_order": 200
    },
    {
      "slug": "silver-rain-trail",
      "name": "Silver rain trail",
      "description": "Long, cool silver trails that widen and fall like rain.",
      "kind": "trail",
      "defaults_json": {
        "burstTrail": {
          "version": 2,
          "enabled": true,
          "preset": "silverRain",
          "colourMode": "silver",
          "particlesPerStar": 112,
          "frontClump": 0.42,
          "width": { "front": 1.2, "tail": 4.2, "curve": 1.45 },
          "particleSize": { "base": 0.78, "headScale": 1, "tailScale": 0.38, "variationPercent": 32 },
          "opening": {
            "size": { "startPercent": 100 },
            "visibility": { "brightnessPercent": 100, "particlesPercent": 100, "revealPercent": 24 }
          },
          "closing": {
            "colour": { "enabled": false, "color": { "r": 1, "g": 0.34, "b": 0.08 }, "fadePercent": 22 },
            "size": { "enabled": false, "endPercent": 0, "shrinkPercent": 22 },
            "spreadFade": { "enabled": true, "startAngle": 60, "endOpacityPercent": 12 }
          },
          "placement": { "headGapPercent": 50 },
          "spacing": { "curve": 1.25, "jitterPercent": 30 },
          "lifetime": { "mode": "dynamic", "percent": 0.42, "baseSeconds": 2.8, "variationPercent": 36, "afterglowSeconds": 0.45 },
          "intensity": { "brightness": 1.12, "fadeSoftness": 1.7 },
          "flicker": { "chance": 0.14, "strength": 0.8, "lifetimeMultiplier": 0.5 },
          "motion": { "gravity": -0.16, "drag": 0.72, "inheritedVelocity": 0.012, "turbulence": 0.08, "driftX": 0, "driftY": -0.09, "driftZ": 0, "spin": 0 },
          "stops": [
            { "position": 0, "density": 1.3, "size": 0.94, "sizeVariation": 28, "shapeWeights": { "circle": 12, "square": 80, "triangle": 8 } },
            { "position": 55, "density": 0.84, "size": 0.68, "sizeVariation": 34, "shapeWeights": { "circle": 18, "square": 72, "triangle": 10 } },
            { "position": 100, "density": 0.22, "size": 0.3, "sizeVariation": 45, "shapeWeights": { "circle": 34, "square": 58, "triangle": 8 } }
          ]
        }
      },
      "sort_order": 210
    },
    {
      "slug": "ghost-fade-trail",
      "name": "Ghost fade trail",
      "description": "A cool trail that blooms from a small head and dissolves into a pale afterimage.",
      "kind": "trail",
      "defaults_json": {
        "burstTrail": {
          "version": 2,
          "enabled": true,
          "preset": "ghostFade",
          "colourMode": "starFade",
          "particlesPerStar": 76,
          "frontClump": 0.58,
          "width": { "front": 1.6, "tail": 2.8, "curve": 1.2 },
          "particleSize": { "base": 0.72, "headScale": 1.08, "tailScale": 0.2, "variationPercent": 24 },
          "opening": {
            "size": { "startPercent": 35 },
            "visibility": { "brightnessPercent": 165, "particlesPercent": 72, "revealPercent": 18 }
          },
          "closing": {
            "colour": { "enabled": true, "color": { "r": 0.55, "g": 0.72, "b": 1 }, "fadePercent": 46 },
            "size": { "enabled": true, "endPercent": 0, "shrinkPercent": 42 },
            "spreadFade": { "enabled": true, "startAngle": 36, "endOpacityPercent": 4 }
          },
          "placement": { "headGapPercent": 46 },
          "spacing": { "curve": 1.4, "jitterPercent": 16 },
          "lifetime": { "mode": "fixed", "percent": 0.28, "baseSeconds": 1.65, "variationPercent": 22, "afterglowSeconds": 0.55 },
          "intensity": { "brightness": 1.22, "fadeSoftness": 2.25 },
          "flicker": { "chance": 0.03, "strength": 0.45, "lifetimeMultiplier": 0.5 },
          "motion": { "gravity": -0.045, "drag": 1.05, "inheritedVelocity": 0.025, "turbulence": 0.035, "driftX": 0, "driftY": -0.018, "driftZ": 0, "spin": 0 },
          "stops": [
            { "position": 0, "density": 1.1, "size": 0.84, "sizeVariation": 22, "shapeWeights": { "circle": 76, "square": 20, "triangle": 4 } },
            { "position": 60, "density": 0.68, "size": 0.5, "sizeVariation": 28, "shapeWeights": { "circle": 86, "square": 12, "triangle": 2 } },
            { "position": 100, "density": 0.12, "size": 0.18, "sizeVariation": 36, "shapeWeights": { "circle": 94, "square": 6, "triangle": 0 } }
          ]
        }
      },
      "sort_order": 220
    },
    {
      "slug": "dragon-egg-trail",
      "name": "Dragon egg trail",
      "description": "A turbulent ember cloud with irregular particles, strong flicker and a short burn.",
      "kind": "trail",
      "defaults_json": {
        "burstTrail": {
          "version": 2,
          "enabled": true,
          "preset": "dragonEgg",
          "colourMode": "ember",
          "particlesPerStar": 148,
          "frontClump": 0.64,
          "width": { "front": 4.8, "tail": 7.5, "curve": 0.82 },
          "particleSize": { "base": 1.18, "headScale": 1.3, "tailScale": 0.3, "variationPercent": 72 },
          "opening": {
            "size": { "startPercent": 100 },
            "visibility": { "brightnessPercent": 100, "particlesPercent": 100, "revealPercent": 24 }
          },
          "closing": {
            "colour": { "enabled": false, "color": { "r": 1, "g": 0.34, "b": 0.08 }, "fadePercent": 22 },
            "size": { "enabled": true, "endPercent": 0, "shrinkPercent": 34 },
            "spreadFade": { "enabled": true, "startAngle": 60, "endOpacityPercent": 12 }
          },
          "placement": { "headGapPercent": 38 },
          "spacing": { "curve": 0.72, "jitterPercent": 78 },
          "lifetime": { "mode": "fixed", "percent": 0.2, "baseSeconds": 0.58, "variationPercent": 68, "afterglowSeconds": 0.24 },
          "intensity": { "brightness": 1.5, "fadeSoftness": 0.72 },
          "flicker": { "chance": 0.62, "strength": 1.7, "lifetimeMultiplier": 0.28 },
          "motion": { "gravity": -0.22, "drag": 2.8, "inheritedVelocity": 0.008, "turbulence": 0.88, "driftX": 0, "driftY": -0.08, "driftZ": 0, "spin": 1.6 },
          "stops": [
            { "position": 0, "density": 2.2, "size": 1.4, "sizeVariation": 65, "shapeWeights": { "circle": 48, "square": 32, "triangle": 20 } },
            { "position": 45, "density": 1.45, "size": 0.92, "sizeVariation": 76, "shapeWeights": { "circle": 58, "square": 26, "triangle": 16 } },
            { "position": 100, "density": 0.38, "size": 0.3, "sizeVariation": 88, "shapeWeights": { "circle": 76, "square": 18, "triangle": 6 } }
          ]
        }
      },
      "sort_order": 230
    },
    {
      "slug": "titanium-flash-trail",
      "name": "Titanium flash trail",
      "description": "A very bright, short-lived silver flash with violent scatter and rapid decay.",
      "kind": "trail",
      "defaults_json": {
        "burstTrail": {
          "version": 2,
          "enabled": true,
          "preset": "titaniumFlash",
          "colourMode": "silver",
          "particlesPerStar": 180,
          "frontClump": 0.78,
          "width": { "front": 6.5, "tail": 5.5, "curve": 0.65 },
          "particleSize": { "base": 1.45, "headScale": 1.5, "tailScale": 0.16, "variationPercent": 62 },
          "opening": {
            "size": { "startPercent": 55 },
            "visibility": { "brightnessPercent": 240, "particlesPercent": 100, "revealPercent": 8 }
          },
          "closing": {
            "colour": { "enabled": false, "color": { "r": 1, "g": 0.34, "b": 0.08 }, "fadePercent": 22 },
            "size": { "enabled": true, "endPercent": 0, "shrinkPercent": 24 },
            "spreadFade": { "enabled": true, "startAngle": 60, "endOpacityPercent": 12 }
          },
          "placement": { "headGapPercent": 24 },
          "spacing": { "curve": 0.58, "jitterPercent": 66 },
          "lifetime": { "mode": "fixed", "percent": 0.12, "baseSeconds": 0.22, "variationPercent": 58, "afterglowSeconds": 0.16 },
          "intensity": { "brightness": 2.25, "fadeSoftness": 0.55 },
          "flicker": { "chance": 0.48, "strength": 2.2, "lifetimeMultiplier": 0.2 },
          "motion": { "gravity": -0.3, "drag": 3.2, "inheritedVelocity": 0.006, "turbulence": 1.25, "driftX": 0, "driftY": -0.12, "driftZ": 0, "spin": 2.8 },
          "stops": [
            { "position": 0, "density": 2.8, "size": 1.8, "sizeVariation": 58, "shapeWeights": { "circle": 42, "square": 38, "triangle": 20 } },
            { "position": 35, "density": 1.4, "size": 0.92, "sizeVariation": 72, "shapeWeights": { "circle": 58, "square": 28, "triangle": 14 } },
            { "position": 100, "density": 0.18, "size": 0.2, "sizeVariation": 90, "shapeWeights": { "circle": 82, "square": 12, "triangle": 6 } }
          ]
        }
      },
      "sort_order": 240
    },
    {
      "slug": "launch-clean-carrier",
      "name": "Clean carrier launch",
      "description": "A bright visible carrier with no lift-particle trail.",
      "kind": "launch",
      "defaults_json": {
        "liftVelocity": 17,
        "launch": {
          "shell": {
            "visible": true,
            "shape": "orb",
            "sizeScale": 0.65,
            "brightness": 1.4,
            "glowStrength": 1.8,
            "trail": { "tubeDiameter": 0, "frontAngle": 0, "tailAngle": 0, "curve": 1 }
          },
          "liftParticles": {
            "appearanceMode": "inherit",
            "enabled": false,
            "amount": 0,
            "height": 100,
            "shapeWeights": { "circle": 0, "square": 100, "triangle": 0 },
            "particleSize": { "base": 30, "headScale": 1, "tailScale": 0.35, "variationPercent": 20 },
            "frontClump": 0.55,
            "spacing": { "curve": 1, "jitterPercent": 35, "clusterStrength": 0, "pathSamples": 5 },
            "lifetime": { "baseSeconds": 0.8, "variationPercent": 35, "afterglowSeconds": 0.1 },
            "intensity": { "brightness": 1, "fadeSoftness": 1 },
            "flicker": { "chance": 0.08, "strength": 0.8, "lifetimeMultiplier": 0.45 },
            "motion": { "gravity": -0.09, "drag": 2.55, "inheritedVelocity": 0.02, "turbulence": 0.04, "driftX": 0, "driftY": -0.012, "driftZ": 0, "spin": 0, "swirlStrength": 0, "swirlRadius": 0, "swirlLoopCount": 0, "swirlLoopLength": 100, "swirlLoopHeight": 0, "swirlRate": 4 }
          }
        }
      },
      "sort_order": 200
    },
    {
      "slug": "launch-gold-comet",
      "name": "Gold comet launch",
      "description": "A dense golden lift trail concentrated around the rising shell.",
      "kind": "launch",
      "defaults_json": {
        "liftVelocity": 15,
        "launch": {
          "shell": {
            "visible": true,
            "shape": "circle",
            "colour": { "r": 1, "g": 0.68, "b": 0.16 },
            "sizeScale": 1,
            "brightness": 1.6,
            "glowStrength": 1.9,
            "trail": { "tubeDiameter": 4, "frontAngle": 3, "tailAngle": 1, "curve": 1.15 }
          },
          "liftParticles": {
            "appearanceMode": "custom",
            "enabled": true,
            "amount": 180,
            "colour": { "r": 1, "g": 0.68, "b": 0.16 },
            "height": 100,
            "shapeWeights": { "circle": 12, "square": 82, "triangle": 6 },
            "particleSize": { "base": 26, "headScale": 1.15, "tailScale": 0.3, "variationPercent": 28 },
            "frontClump": 0.68,
            "spacing": { "curve": 1.2, "jitterPercent": 24, "clusterStrength": 15, "pathSamples": 7 },
            "lifetime": { "baseSeconds": 1.05, "variationPercent": 34, "afterglowSeconds": 0.16 },
            "intensity": { "brightness": 1.35, "fadeSoftness": 1.1 },
            "flicker": { "chance": 0.12, "strength": 0.95, "lifetimeMultiplier": 0.42 },
            "motion": { "gravity": -0.08, "drag": 2.1, "inheritedVelocity": 0.03, "turbulence": 0.08, "driftX": 0, "driftY": -0.016, "driftZ": 0, "spin": 0.2, "swirlStrength": 0, "swirlRadius": 0, "swirlLoopCount": 0, "swirlLoopLength": 100, "swirlLoopHeight": 0, "swirlRate": 4 }
          }
        }
      },
      "sort_order": 210
    },
    {
      "slug": "launch-silver-serpent",
      "name": "Silver serpent launch",
      "description": "A silver lift trail that coils twice around the carrier path.",
      "kind": "launch",
      "defaults_json": {
        "liftVelocity": 14,
        "launch": {
          "shell": {
            "visible": true,
            "shape": "orb",
            "colour": { "r": 0.85, "g": 0.92, "b": 1 },
            "sizeScale": 0.9,
            "brightness": 1.7,
            "glowStrength": 2,
            "trail": { "tubeDiameter": 3, "frontAngle": 2, "tailAngle": 4, "curve": 1.35 }
          },
          "liftParticles": {
            "appearanceMode": "custom",
            "enabled": true,
            "amount": 220,
            "colour": { "r": 0.85, "g": 0.92, "b": 1 },
            "height": 100,
            "shapeWeights": { "circle": 54, "square": 38, "triangle": 8 },
            "particleSize": { "base": 24, "headScale": 1.1, "tailScale": 0.28, "variationPercent": 34 },
            "frontClump": 0.58,
            "spacing": { "curve": 1, "jitterPercent": 30, "clusterStrength": 10, "pathSamples": 9 },
            "lifetime": { "baseSeconds": 1.15, "variationPercent": 38, "afterglowSeconds": 0.2 },
            "intensity": { "brightness": 1.45, "fadeSoftness": 1.2 },
            "flicker": { "chance": 0.18, "strength": 1.1, "lifetimeMultiplier": 0.4 },
            "motion": { "gravity": -0.08, "drag": 1.4, "inheritedVelocity": 0.025, "turbulence": 0.12, "driftX": 0, "driftY": -0.018, "driftZ": 0, "spin": 0.5, "swirlStrength": 1.4, "swirlRadius": 36, "swirlLoopCount": 2, "swirlLoopLength": 80, "swirlLoopHeight": 45, "swirlRate": 8 }
          }
        }
      },
      "sort_order": 220
    },
    {
      "slug": "launch-titanium-flare",
      "name": "Titanium flare launch",
      "description": "A short, brilliant silver lift with large irregular fragments and hard flicker.",
      "kind": "launch",
      "defaults_json": {
        "liftVelocity": 18,
        "launch": {
          "shell": {
            "visible": true,
            "shape": "square",
            "colour": { "r": 0.92, "g": 0.96, "b": 1 },
            "sizeScale": 1.15,
            "brightness": 2.2,
            "glowStrength": 2.4,
            "trail": { "tubeDiameter": 8, "frontAngle": 7, "tailAngle": 5, "curve": 0.7 }
          },
          "liftParticles": {
            "appearanceMode": "custom",
            "enabled": true,
            "amount": 260,
            "colour": { "r": 0.92, "g": 0.96, "b": 1 },
            "height": 86,
            "shapeWeights": { "circle": 24, "square": 48, "triangle": 28 },
            "particleSize": { "base": 42, "headScale": 1.4, "tailScale": 0.18, "variationPercent": 68 },
            "frontClump": 0.78,
            "spacing": { "curve": 0.65, "jitterPercent": 72, "clusterStrength": 48, "pathSamples": 5 },
            "lifetime": { "baseSeconds": 0.42, "variationPercent": 62, "afterglowSeconds": 0.18 },
            "intensity": { "brightness": 2.3, "fadeSoftness": 0.58 },
            "flicker": { "chance": 0.58, "strength": 2.2, "lifetimeMultiplier": 0.22 },
            "motion": { "gravity": -0.24, "drag": 3.4, "inheritedVelocity": 0.01, "turbulence": 1.1, "driftX": 0, "driftY": -0.09, "driftZ": 0, "spin": 2.5, "swirlStrength": 0, "swirlRadius": 0, "swirlLoopCount": 0, "swirlLoopLength": 100, "swirlLoopHeight": 0, "swirlRate": 4 }
          }
        }
      },
      "sort_order": 230
    },
    {
      "slug": "launch-heavy-shell",
      "name": "Heavy shell launch",
      "description": "A slower, larger carrier with a dense lift trail and lingering embers.",
      "kind": "launch",
      "defaults_json": {
        "liftVelocity": 12,
        "launch": {
          "shell": {
            "visible": true,
            "shape": "orb",
            "sizeScale": 1.5,
            "brightness": 1.5,
            "glowStrength": 1.8,
            "trail": { "tubeDiameter": 5, "frontAngle": 2, "tailAngle": 3, "curve": 1.4 }
          },
          "liftParticles": {
            "appearanceMode": "inherit",
            "enabled": true,
            "amount": 140,
            "height": 100,
            "shapeWeights": { "circle": 14, "square": 80, "triangle": 6 },
            "particleSize": { "base": 34, "headScale": 1.15, "tailScale": 0.38, "variationPercent": 32 },
            "frontClump": 0.62,
            "spacing": { "curve": 1.35, "jitterPercent": 28, "clusterStrength": 22, "pathSamples": 7 },
            "lifetime": { "baseSeconds": 1.3, "variationPercent": 42, "afterglowSeconds": 0.28 },
            "intensity": { "brightness": 1.2, "fadeSoftness": 1.25 },
            "flicker": { "chance": 0.1, "strength": 0.85, "lifetimeMultiplier": 0.45 },
            "motion": { "gravity": -0.11, "drag": 1.8, "inheritedVelocity": 0.035, "turbulence": 0.12, "driftX": 0, "driftY": -0.025, "driftZ": 0, "spin": 0.1, "swirlStrength": 0, "swirlRadius": 0, "swirlLoopCount": 0, "swirlLoopLength": 100, "swirlLoopHeight": 0, "swirlRate": 4 }
          }
        }
      },
      "sort_order": 240
    },
    {
      "slug": "smoke-none",
      "name": "No launch smoke",
      "description": "Disables launch and mortar smoke for clean diagnostic previews.",
      "kind": "smoke",
      "defaults_json": {
        "launch": { "smoke": { "enabled": false, "particles": 0 } },
        "mortar": { "smokeParticles": 0 }
      },
      "sort_order": 200
    },
    {
      "slug": "smoke-light-mortar",
      "name": "Light mortar smoke",
      "description": "A short translucent puff suited to small consumer shells.",
      "kind": "smoke",
      "defaults_json": {
        "launch": {
          "smoke": {
            "enabled": true,
            "particles": 45,
            "colour": { "r": 0.18, "g": 0.18, "b": 0.19 },
            "opacity": 0.38,
            "size": 55,
            "sizeVariationPercent": 40,
            "lifeSeconds": 2.2,
            "lifeVariationPercent": 30,
            "expansionPerSecond": 18,
            "spread": 18,
            "drift": 0.7,
            "windX": 0,
            "windZ": 0,
            "turbulence": 0.2,
            "height": 180
          }
        },
        "mortar": { "smokeParticles": 45 }
      },
      "sort_order": 210
    },
    {
      "slug": "smoke-natural-grey-plume",
      "name": "Natural grey plume",
      "description": "A varied medium-grey plume with gradual expansion and mild turbulence.",
      "kind": "smoke",
      "defaults_json": {
        "launch": {
          "smoke": {
            "enabled": true,
            "particles": 140,
            "colour": { "r": 0.12, "g": 0.12, "b": 0.13 },
            "opacity": 0.68,
            "size": 92,
            "sizeVariationPercent": 55,
            "lifeSeconds": 4.4,
            "lifeVariationPercent": 45,
            "expansionPerSecond": 22,
            "spread": 34,
            "drift": 1.1,
            "windX": 0,
            "windZ": 0,
            "turbulence": 0.7,
            "height": 420
          }
        },
        "mortar": { "smokeParticles": 140 }
      },
      "sort_order": 220
    },
    {
      "slug": "smoke-dense-lingering",
      "name": "Dense lingering smoke",
      "description": "A heavy dark plume that expands slowly and remains visible after the break.",
      "kind": "smoke",
      "defaults_json": {
        "launch": {
          "smoke": {
            "enabled": true,
            "particles": 260,
            "colour": { "r": 0.08, "g": 0.08, "b": 0.09 },
            "opacity": 0.78,
            "size": 120,
            "sizeVariationPercent": 65,
            "lifeSeconds": 7.5,
            "lifeVariationPercent": 35,
            "expansionPerSecond": 28,
            "spread": 50,
            "drift": 0.75,
            "windX": 0,
            "windZ": 0,
            "turbulence": 1,
            "height": 520
          }
        },
        "mortar": { "smokeParticles": 260 }
      },
      "sort_order": 230
    },
    {
      "slug": "smoke-crosswind",
      "name": "Crosswind smoke",
      "description": "A realistic plume pulled strongly sideways while continuing to rise and expand.",
      "kind": "smoke",
      "defaults_json": {
        "launch": {
          "smoke": {
            "enabled": true,
            "particles": 160,
            "colour": { "r": 0.14, "g": 0.14, "b": 0.15 },
            "opacity": 0.62,
            "size": 90,
            "sizeVariationPercent": 50,
            "lifeSeconds": 5,
            "lifeVariationPercent": 44,
            "expansionPerSecond": 24,
            "spread": 32,
            "drift": 1.35,
            "windX": 2.2,
            "windZ": 0.6,
            "turbulence": 0.8,
            "height": 460
          }
        },
        "mortar": { "smokeParticles": 160 }
      },
      "sort_order": 240
    },
    {
      "slug": "strobe-slow-shimmer",
      "name": "Slow shimmer",
      "description": "A slow, slightly desynchronised pulse that preserves each star's body.",
      "kind": "strobe",
      "defaults_json": { "strobe": { "enabled": true, "frequencyHz": 4.5, "dutyCycle": 0.5, "amountPercent": 100, "dimPercent": 8, "desync": 0.12 } },
      "sort_order": 200
    },
    {
      "slug": "strobe-classic-white",
      "name": "Classic strobe",
      "description": "A balanced full-field strobe with mild phase separation between stars.",
      "kind": "strobe",
      "defaults_json": { "strobe": { "enabled": true, "frequencyHz": 10, "dutyCycle": 0.42, "amountPercent": 100, "dimPercent": 3, "desync": 0.05 } },
      "sort_order": 210
    },
    {
      "slug": "strobe-rapid-flicker",
      "name": "Rapid flicker",
      "description": "A sharp high-frequency blink with nearly black dark phases.",
      "kind": "strobe",
      "defaults_json": { "strobe": { "enabled": true, "frequencyHz": 22, "dutyCycle": 0.25, "amountPercent": 100, "dimPercent": 0, "desync": 0.18 } },
      "sort_order": 220
    },
    {
      "slug": "strobe-scattered-twinkle",
      "name": "Scattered twinkle",
      "description": "Only part of the burst flickers, with broad phase variation across the stars.",
      "kind": "strobe",
      "defaults_json": { "strobe": { "enabled": true, "frequencyHz": 13, "dutyCycle": 0.32, "amountPercent": 48, "dimPercent": 8, "desync": 0.85 } },
      "sort_order": 230
    },
    {
      "slug": "strobe-synchronised-pulse",
      "name": "Synchronised pulse",
      "description": "Every star blinks together for a deliberate graphic pulse.",
      "kind": "strobe",
      "defaults_json": { "strobe": { "enabled": true, "frequencyHz": 7, "dutyCycle": 0.4, "amountPercent": 100, "dimPercent": 0, "desync": 0 } },
      "sort_order": 240
    },
    {
      "slug": "crackle-fine-silver",
      "name": "Fine silver crackle",
      "description": "Sparse, small silver crackles with restrained sound and short fragment lives.",
      "kind": "crackle",
      "defaults_json": {
        "crackle": {
          "enabled": true,
          "probability": 0.015,
          "triggerWindowSeconds": 0.7,
          "fragmentCount": 24,
          "fragmentCountVariationPercent": 70,
          "fragmentSize": 14,
          "fragmentSizeVariationPercent": 70,
          "fragmentSpeed": 0.75,
          "fragmentSpeedVariationPercent": 60,
          "fragmentLifeSeconds": 0.38,
          "fragmentLifeVariationPercent": 70,
          "fragmentGravity": -0.25,
          "colourMode": "silver",
          "sound": "crackle",
          "soundChance": 0.08,
          "soundVolume": 0.06
        }
      },
      "sort_order": 200
    },
    {
      "slug": "crackle-dense-chrysanthemum",
      "name": "Dense chrysanthemum crackle",
      "description": "A broad late-life crackle cloud with medium fragments and natural variation.",
      "kind": "crackle",
      "defaults_json": {
        "crackle": {
          "enabled": true,
          "probability": 0.06,
          "triggerWindowSeconds": 1.2,
          "fragmentCount": 58,
          "fragmentCountVariationPercent": 72,
          "fragmentSize": 24,
          "fragmentSizeVariationPercent": 78,
          "fragmentSpeed": 1.2,
          "fragmentSpeedVariationPercent": 65,
          "fragmentLifeSeconds": 0.68,
          "fragmentLifeVariationPercent": 76,
          "fragmentGravity": -0.22,
          "colourMode": "gold",
          "sound": "crackle",
          "soundChance": 0.22,
          "soundVolume": 0.14
        }
      },
      "sort_order": 210
    },
    {
      "slug": "crackle-dragon-egg",
      "name": "Dragon egg crackle",
      "description": "A turbulent high-density crackle with bright irregular fragments and strong audio.",
      "kind": "crackle",
      "defaults_json": {
        "crackle": {
          "enabled": true,
          "probability": 0.16,
          "triggerWindowSeconds": 1.6,
          "fragmentCount": 80,
          "fragmentCountVariationPercent": 88,
          "fragmentSize": 30,
          "fragmentSizeVariationPercent": 92,
          "fragmentSpeed": 1.5,
          "fragmentSpeedVariationPercent": 82,
          "fragmentLifeSeconds": 0.85,
          "fragmentLifeVariationPercent": 90,
          "fragmentGravity": -0.24,
          "colourMode": "gold",
          "sound": "crackle",
          "soundChance": 0.35,
          "soundVolume": 0.22
        }
      },
      "sort_order": 220
    },
    {
      "slug": "crackle-heavy-report",
      "name": "Heavy report crackle",
      "description": "Large fast fragments with frequent light-report accents near the end of life.",
      "kind": "crackle",
      "defaults_json": {
        "crackle": {
          "enabled": true,
          "probability": 0.08,
          "triggerWindowSeconds": 0.65,
          "fragmentCount": 32,
          "fragmentCountVariationPercent": 55,
          "fragmentSize": 42,
          "fragmentSizeVariationPercent": 65,
          "fragmentSpeed": 2.2,
          "fragmentSpeedVariationPercent": 58,
          "fragmentLifeSeconds": 0.55,
          "fragmentLifeVariationPercent": 62,
          "fragmentGravity": -0.28,
          "colourMode": "silver",
          "sound": "lightBoom",
          "soundChance": 0.5,
          "soundVolume": 0.35
        }
      },
      "sort_order": 230
    },
    {
      "slug": "split-classic-four-way",
      "name": "Classic four-way crossette",
      "description": "A balanced four-fragment split with a readable pause before separation.",
      "kind": "split",
      "defaults_json": { "split": { "enabled": true, "fragments": 4, "speed": 1.55, "delayRatio": 0.42, "lifeBaseSeconds": 0.65, "lifeVariationSeconds": 1.6, "headSizePercent": 50, "trailLifePercent": 60 } },
      "sort_order": 200
    },
    {
      "slug": "split-six-way",
      "name": "Six-way crossette",
      "description": "A fuller six-fragment break with moderate separation speed.",
      "kind": "split",
      "defaults_json": { "split": { "enabled": true, "fragments": 6, "speed": 1.7, "delayRatio": 0.46, "lifeBaseSeconds": 0.6, "lifeVariationSeconds": 1.35, "headSizePercent": 44, "trailLifePercent": 58 } },
      "sort_order": 210
    },
    {
      "slug": "split-rapid-cross",
      "name": "Rapid cross split",
      "description": "A quick four-way split with fast fragments and short secondary trails.",
      "kind": "split",
      "defaults_json": { "split": { "enabled": true, "fragments": 4, "speed": 2.4, "delayRatio": 0.22, "lifeBaseSeconds": 0.38, "lifeVariationSeconds": 0.85, "headSizePercent": 42, "trailLifePercent": 42 } },
      "sort_order": 220
    },
    {
      "slug": "split-delayed-eight-way",
      "name": "Delayed eight-way split",
      "description": "A late, wide eight-fragment crossette with long-burning secondary stars.",
      "kind": "split",
      "defaults_json": { "split": { "enabled": true, "fragments": 8, "speed": 1.9, "delayRatio": 0.7, "lifeBaseSeconds": 0.9, "lifeVariationSeconds": 2.2, "headSizePercent": 38, "trailLifePercent": 82 } },
      "sort_order": 230
    },
    {
      "slug": "sound-silent",
      "name": "Silent",
      "description": "Disables launch and burst reports for visual-only previews.",
      "kind": "sound",
      "defaults_json": { "sound": { "launch": false, "boom": "none" }, "mortar": { "sound": false } },
      "sort_order": 200
    },
    {
      "slug": "sound-launch-only",
      "name": "Launch only",
      "description": "Keeps the lift sound while suppressing the burst report.",
      "kind": "sound",
      "defaults_json": { "sound": { "launch": true, "boom": "none" }, "mortar": { "sound": true } },
      "sort_order": 210
    },
    {
      "slug": "sound-light-report",
      "name": "Light report",
      "description": "A lift sound followed by a restrained consumer-shell report.",
      "kind": "sound",
      "defaults_json": { "sound": { "launch": true, "boom": "light" }, "mortar": { "sound": true } },
      "sort_order": 220
    },
    {
      "slug": "sound-heavy-display-report",
      "name": "Heavy display report",
      "description": "A lift sound followed by the renderer's strongest display-shell report.",
      "kind": "sound",
      "defaults_json": { "sound": { "launch": true, "boom": "heavy" }, "mortar": { "sound": true } },
      "sort_order": 230
    }
  ]
  $seed$::jsonb) as seed(
    slug text,
    name text,
    description text,
    kind text,
    defaults_json jsonb,
    sort_order integer
  )
)
insert into public.firework_style_defaults as existing (
  slug,
  name,
  description,
  kind,
  defaults_json,
  sort_order
)
select
  slug,
  name,
  description,
  kind,
  defaults_json,
  sort_order
from seeded_defaults
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  defaults_json = excluded.defaults_json,
  sort_order = excluded.sort_order,
  is_archived = false,
  updated_at = clock_timestamp()
where (
  existing.name,
  existing.description,
  existing.kind,
  existing.defaults_json,
  existing.sort_order,
  existing.is_archived
) is distinct from (
  excluded.name,
  excluded.description,
  excluded.kind,
  excluded.defaults_json,
  excluded.sort_order,
  false
);
