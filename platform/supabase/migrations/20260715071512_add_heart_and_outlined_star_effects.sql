-- Manual effects survive generated catalogue reseeds and remain editable in
-- the admin effect editor without creating concrete fireworks or products.
with seeded_effects as (
  select *
  from jsonb_to_recordset($effects$
  [
    {
      "slug": "heart-shell",
      "name": "Heart Shell",
      "description": "A crisp planar heart outline with a smaller warm inner heart and restrained trailing sparks.",
      "family": "aerial_burst",
      "pattern_key": "heart",
      "sort_order": 150,
      "source": "manual",
      "model_json": {
        "version": 3,
        "geometry": "heart",
        "trailProfile": "spark",
        "renderDefaults": {
          "pattern": "fibonacci",
          "geometry": "heart",
          "trailProfile": "spark",
          "colour": { "enabled": true },
          "size": 100,
          "liftVelocity": 20,
          "shellLife": 5.2,
          "burst": {
            "speed": [1.6, 1.9],
            "gravity": [-0.1, -0.03],
            "life": [2.6, 3.5],
            "flairColorMode": "bombColor"
          },
          "trail": {
            "density": 1.4,
            "length": 1.2,
            "sparkle": 0.35,
            "thickness": 0.9,
            "streakSize": 0.9,
            "streakLength": 1.1,
            "streakLife": 1.15
          },
          "flair": { "enabled": true },
          "crackle": {
            "enabled": false,
            "probability": 0,
            "triggerWindowSeconds": 0.8,
            "fragmentCount": 36,
            "fragmentCountVariationPercent": 70,
            "fragmentSize": 20,
            "fragmentSizeVariationPercent": 72,
            "fragmentSpeed": 1,
            "fragmentSpeedVariationPercent": 65,
            "fragmentLifeSeconds": 0.55,
            "fragmentLifeVariationPercent": 75,
            "fragmentGravity": -0.2,
            "colourMode": "silver",
            "sound": "crackle",
            "soundChance": 0.12,
            "soundVolume": 0.08
          },
          "strobe": {
            "enabled": false,
            "frequencyHz": 10,
            "dutyCycle": 0.42,
            "amountPercent": 100,
            "dimPercent": 4,
            "desync": 0.04
          },
          "split": {
            "enabled": false,
            "fragments": 4,
            "speed": 1.55,
            "delayRatio": 0.42,
            "lifeBaseSeconds": 0.65,
            "lifeVariationSeconds": 1.6,
            "headSizePercent": 50,
            "trailLifePercent": 60
          },
          "sound": { "launch": true, "boom": "light" },
          "mortar": { "sound": true, "smokeParticles": 110 },
          "geometryTuning": {
            "heart": {
              "countPercent": 96,
              "scaleX": 1.04,
              "scaleY": 1.12,
              "depthScale": 0.025,
              "outlineJitter": 0.012,
              "tiltVariation": 0.1,
              "rotationDegrees": 0
            }
          },
          "launch": {
            "shell": {
              "visible": true,
              "shape": "orb",
              "sizeScale": 0.9,
              "brightness": 1.55,
              "glowStrength": 1.8,
              "trail": {
                "tubeDiameter": 2.5,
                "frontAngle": 1.5,
                "tailAngle": 2.5,
                "curve": 1.2
              }
            },
            "liftParticles": {
              "appearanceMode": "inherit",
              "enabled": true,
              "amount": 140,
              "height": 100,
              "shapeWeights": { "circle": 20, "square": 72, "triangle": 8 },
              "particleSize": {
                "base": 28,
                "headScale": 1.1,
                "tailScale": 0.3,
                "variationPercent": 30
              },
              "frontClump": 0.62,
              "spacing": {
                "curve": 1.15,
                "jitterPercent": 28,
                "clusterStrength": 12,
                "pathSamples": 7
              },
              "lifetime": {
                "baseSeconds": 1,
                "variationPercent": 34,
                "afterglowSeconds": 0.16
              },
              "intensity": { "brightness": 1.25, "fadeSoftness": 1.1 },
              "flicker": { "chance": 0.12, "strength": 0.9, "lifetimeMultiplier": 0.42 },
              "motion": {
                "gravity": -0.08,
                "drag": 2,
                "inheritedVelocity": 0.03,
                "turbulence": 0.08,
                "driftX": 0,
                "driftY": -0.016,
                "driftZ": 0,
                "spin": 0.15,
                "swirlStrength": 0,
                "swirlRadius": 0,
                "swirlLoopCount": 0,
                "swirlLoopLength": 100,
                "swirlLoopHeight": 0,
                "swirlRate": 4
              }
            },
            "smoke": {
              "enabled": true,
              "particles": 110,
              "colour": { "r": 0.13, "g": 0.13, "b": 0.14 },
              "opacity": 0.62,
              "size": 84,
              "sizeVariationPercent": 52,
              "lifeSeconds": 3.8,
              "lifeVariationPercent": 42,
              "expansionPerSecond": 21,
              "spread": 30,
              "drift": 0.95,
              "windX": 0,
              "windZ": 0,
              "turbulence": 0.55,
              "height": 380
            }
          },
          "stars": {
            "outer": {
              "enabled": true,
              "count": 100,
              "burst": {
                "speed": [1.6, 1.9],
                "gravity": [-0.1, -0.03],
                "life": [2.6, 3.5],
                "flairColorMode": "bombColor"
              },
              "head": {
                "visible": true,
                "size": 245,
                "opening": {
                  "colour": {
                    "enabled": false,
                    "color": { "r": 1, "g": 0.42, "b": 0.08 },
                    "fadePercent": 24
                  },
                  "size": { "enabled": true, "startPercent": 45, "growPercent": 18 }
                },
                "closing": {
                  "colour": {
                    "enabled": false,
                    "color": { "r": 1, "g": 0.84, "b": 0.4 },
                    "fadePercent": 22
                  },
                  "size": { "enabled": true, "endPercent": 0, "shrinkPercent": 36 }
                },
                "glowStrength": 1.7,
                "glowPadding": 150,
                "whiteCoreSizePercent": 20,
                "whiteCoreBlurPercent": 15,
                "coreSoftness": 52,
                "coreBrightness": 58,
                "coreOpacityFalloff": 60,
                "glowSize": 90,
                "glowSoftness": 96,
                "glowOpacityFalloff": 100,
                "glowBlur": 46,
                "backgroundGlowOpacityFalloff": 76,
                "backgroundGlowSoftness": 52,
                "brightnessHoldPercent": 68,
                "brightnessHoldExponent": 0.95
              },
              "colourPattern": {
                "mode": "solid",
                "axis": "vertical",
                "count": 1,
                "colours": []
              },
              "burstTrail": {
                "version": 2,
                "enabled": true,
                "preset": "solidStreaks",
                "colourMode": "starFade",
                "particlesPerStar": 64,
                "frontClump": 0.6,
                "width": { "front": 1.3, "tail": 2, "curve": 1.1 },
                "particleSize": {
                  "base": 0.8,
                  "headScale": 1.05,
                  "tailScale": 0.35,
                  "variationPercent": 25
                },
                "opening": {
                  "size": { "startPercent": 100 },
                  "visibility": {
                    "brightnessPercent": 100,
                    "particlesPercent": 100,
                    "revealPercent": 18
                  }
                },
                "closing": {
                  "colour": {
                    "enabled": false,
                    "color": { "r": 1, "g": 0.34, "b": 0.08 },
                    "fadePercent": 22
                  },
                  "size": { "enabled": true, "endPercent": 0, "shrinkPercent": 35 },
                  "spreadFade": { "enabled": true, "startAngle": 48, "endOpacityPercent": 8 }
                },
                "placement": { "headGapPercent": 44 },
                "spacing": { "curve": 1.15, "jitterPercent": 20 },
                "lifetime": {
                  "mode": "dynamic",
                  "percent": 0.22,
                  "baseSeconds": 1.35,
                  "variationPercent": 28,
                  "afterglowSeconds": 0.25
                },
                "intensity": { "brightness": 1.1, "fadeSoftness": 1.1 },
                "flicker": { "chance": 0.1, "strength": 0.8, "lifetimeMultiplier": 0.45 },
                "motion": {
                  "gravity": -0.03,
                  "drag": 1.5,
                  "inheritedVelocity": 0.02,
                  "turbulence": 0.05,
                  "driftX": 0,
                  "driftY": -0.015,
                  "driftZ": 0,
                  "spin": 0
                },
                "stops": [
                  {
                    "position": 0,
                    "density": 1.45,
                    "size": 0.92,
                    "sizeVariation": 24,
                    "shapeWeights": { "circle": 8, "square": 86, "triangle": 6 }
                  },
                  {
                    "position": 52,
                    "density": 0.82,
                    "size": 0.62,
                    "sizeVariation": 30,
                    "shapeWeights": { "circle": 12, "square": 80, "triangle": 8 }
                  },
                  {
                    "position": 100,
                    "density": 0.2,
                    "size": 0.26,
                    "sizeVariation": 38,
                    "shapeWeights": { "circle": 24, "square": 70, "triangle": 6 }
                  }
                ]
              }
            },
            "core": {
              "enabled": true,
              "count": 56,
              "burst": {
                "speed": [0.82, 1.05],
                "gravity": [-0.08, -0.02],
                "life": [2.3, 3.1],
                "flairColorMode": "mixed"
              },
              "head": {
                "visible": true,
                "size": 170,
                "opening": {
                  "colour": {
                    "enabled": false,
                    "color": { "r": 1, "g": 0.42, "b": 0.08 },
                    "fadePercent": 24
                  },
                  "size": { "enabled": true, "startPercent": 38, "growPercent": 20 }
                },
                "closing": {
                  "colour": {
                    "enabled": false,
                    "color": { "r": 1, "g": 0.84, "b": 0.4 },
                    "fadePercent": 22
                  },
                  "size": { "enabled": true, "endPercent": 0, "shrinkPercent": 34 }
                },
                "glowStrength": 1.55,
                "glowPadding": 130,
                "whiteCoreSizePercent": 24,
                "whiteCoreBlurPercent": 14,
                "coreSoftness": 50,
                "coreBrightness": 62,
                "coreOpacityFalloff": 60,
                "glowSize": 86,
                "glowSoftness": 94,
                "glowOpacityFalloff": 100,
                "glowBlur": 40,
                "backgroundGlowOpacityFalloff": 78,
                "backgroundGlowSoftness": 55,
                "brightnessHoldPercent": 62,
                "brightnessHoldExponent": 0.9
              },
              "colourPattern": {
                "mode": "solid",
                "axis": "vertical",
                "count": 1,
                "colours": []
              },
              "burstTrail": {
                "version": 2,
                "enabled": true,
                "preset": "sparkDust",
                "colourMode": "star",
                "particlesPerStar": 22,
                "frontClump": 0.4,
                "width": { "front": 0.8, "tail": 1.5, "curve": 1.2 },
                "particleSize": {
                  "base": 0.52,
                  "headScale": 1,
                  "tailScale": 0.38,
                  "variationPercent": 48
                },
                "opening": {
                  "size": { "startPercent": 100 },
                  "visibility": {
                    "brightnessPercent": 100,
                    "particlesPercent": 80,
                    "revealPercent": 20
                  }
                },
                "closing": {
                  "colour": {
                    "enabled": false,
                    "color": { "r": 1, "g": 0.34, "b": 0.08 },
                    "fadePercent": 22
                  },
                  "size": { "enabled": true, "endPercent": 0, "shrinkPercent": 32 },
                  "spreadFade": { "enabled": true, "startAngle": 42, "endOpacityPercent": 6 }
                },
                "placement": { "headGapPercent": 34 },
                "spacing": { "curve": 1, "jitterPercent": 48 },
                "lifetime": {
                  "mode": "dynamic",
                  "percent": 0.15,
                  "baseSeconds": 0.8,
                  "variationPercent": 50,
                  "afterglowSeconds": 0.14
                },
                "intensity": { "brightness": 0.82, "fadeSoftness": 1.3 },
                "flicker": { "chance": 0.2, "strength": 0.7, "lifetimeMultiplier": 0.42 },
                "motion": {
                  "gravity": -0.04,
                  "drag": 2.2,
                  "inheritedVelocity": 0.018,
                  "turbulence": 0.14,
                  "driftX": 0,
                  "driftY": -0.018,
                  "driftZ": 0,
                  "spin": 0
                },
                "stops": [
                  {
                    "position": 0,
                    "density": 1,
                    "size": 0.58,
                    "sizeVariation": 48,
                    "shapeWeights": { "circle": 78, "square": 16, "triangle": 6 }
                  },
                  {
                    "position": 100,
                    "density": 0.16,
                    "size": 0.24,
                    "sizeVariation": 64,
                    "shapeWeights": { "circle": 90, "square": 8, "triangle": 2 }
                  }
                ]
              }
            }
          }
        }
      }
    },
    {
      "slug": "outlined-star-shell",
      "name": "Outlined Star Shell",
      "description": "A sharp five-point outline with a smaller hot inner star and short, controlled streaks.",
      "family": "aerial_burst",
      "pattern_key": "five_point_star",
      "sort_order": 155,
      "source": "manual",
      "model_json": {
        "version": 3,
        "geometry": "five_point_star",
        "trailProfile": "spark",
        "renderDefaults": {
          "pattern": "fibonacci",
          "geometry": "five_point_star",
          "trailProfile": "spark",
          "colour": { "enabled": true },
          "size": 100,
          "liftVelocity": 21,
          "shellLife": 5,
          "burst": {
            "speed": [1.55, 1.82],
            "gravity": [-0.09, -0.02],
            "life": [2.5, 3.3],
            "flairColorMode": "bombColor"
          },
          "trail": {
            "density": 1.3,
            "length": 1.05,
            "sparkle": 0.3,
            "thickness": 0.82,
            "streakSize": 0.85,
            "streakLength": 1,
            "streakLife": 1.05
          },
          "flair": { "enabled": true },
          "crackle": {
            "enabled": false,
            "probability": 0,
            "triggerWindowSeconds": 0.7,
            "fragmentCount": 32,
            "fragmentCountVariationPercent": 65,
            "fragmentSize": 18,
            "fragmentSizeVariationPercent": 70,
            "fragmentSpeed": 0.95,
            "fragmentSpeedVariationPercent": 60,
            "fragmentLifeSeconds": 0.5,
            "fragmentLifeVariationPercent": 70,
            "fragmentGravity": -0.2,
            "colourMode": "silver",
            "sound": "crackle",
            "soundChance": 0.1,
            "soundVolume": 0.07
          },
          "strobe": {
            "enabled": false,
            "frequencyHz": 12,
            "dutyCycle": 0.4,
            "amountPercent": 100,
            "dimPercent": 3,
            "desync": 0.03
          },
          "split": {
            "enabled": false,
            "fragments": 4,
            "speed": 1.55,
            "delayRatio": 0.42,
            "lifeBaseSeconds": 0.65,
            "lifeVariationSeconds": 1.6,
            "headSizePercent": 50,
            "trailLifePercent": 60
          },
          "sound": { "launch": true, "boom": "light" },
          "mortar": { "sound": true, "smokeParticles": 105 },
          "geometryTuning": {
            "fivePointStar": {
              "countPercent": 98,
              "points": 5,
              "innerRadius": 0.4,
              "scaleX": 1,
              "scaleY": 1.08,
              "depthScale": 0.02,
              "outlineJitter": 0.01,
              "tiltVariation": 0.08,
              "rotationDegrees": -90
            }
          },
          "launch": {
            "shell": {
              "visible": true,
              "shape": "orb",
              "sizeScale": 0.85,
              "brightness": 1.65,
              "glowStrength": 1.9,
              "trail": {
                "tubeDiameter": 2,
                "frontAngle": 1,
                "tailAngle": 2,
                "curve": 1.1
              }
            },
            "liftParticles": {
              "appearanceMode": "inherit",
              "enabled": true,
              "amount": 128,
              "height": 100,
              "shapeWeights": { "circle": 18, "square": 76, "triangle": 6 },
              "particleSize": {
                "base": 26,
                "headScale": 1.08,
                "tailScale": 0.28,
                "variationPercent": 28
              },
              "frontClump": 0.64,
              "spacing": {
                "curve": 1.1,
                "jitterPercent": 24,
                "clusterStrength": 8,
                "pathSamples": 7
              },
              "lifetime": {
                "baseSeconds": 0.92,
                "variationPercent": 32,
                "afterglowSeconds": 0.14
              },
              "intensity": { "brightness": 1.35, "fadeSoftness": 1 },
              "flicker": { "chance": 0.1, "strength": 0.85, "lifetimeMultiplier": 0.42 },
              "motion": {
                "gravity": -0.08,
                "drag": 2.2,
                "inheritedVelocity": 0.028,
                "turbulence": 0.06,
                "driftX": 0,
                "driftY": -0.014,
                "driftZ": 0,
                "spin": 0.1,
                "swirlStrength": 0,
                "swirlRadius": 0,
                "swirlLoopCount": 0,
                "swirlLoopLength": 100,
                "swirlLoopHeight": 0,
                "swirlRate": 4
              }
            },
            "smoke": {
              "enabled": true,
              "particles": 105,
              "colour": { "r": 0.14, "g": 0.14, "b": 0.15 },
              "opacity": 0.58,
              "size": 80,
              "sizeVariationPercent": 48,
              "lifeSeconds": 3.5,
              "lifeVariationPercent": 40,
              "expansionPerSecond": 20,
              "spread": 28,
              "drift": 0.9,
              "windX": 0,
              "windZ": 0,
              "turbulence": 0.48,
              "height": 360
            }
          },
          "stars": {
            "outer": {
              "enabled": true,
              "count": 100,
              "burst": {
                "speed": [1.55, 1.82],
                "gravity": [-0.09, -0.02],
                "life": [2.5, 3.3],
                "flairColorMode": "bombColor"
              },
              "head": {
                "visible": true,
                "size": 235,
                "opening": {
                  "colour": {
                    "enabled": false,
                    "color": { "r": 1, "g": 0.42, "b": 0.08 },
                    "fadePercent": 24
                  },
                  "size": { "enabled": true, "startPercent": 42, "growPercent": 16 }
                },
                "closing": {
                  "colour": {
                    "enabled": false,
                    "color": { "r": 1, "g": 0.84, "b": 0.4 },
                    "fadePercent": 22
                  },
                  "size": { "enabled": true, "endPercent": 0, "shrinkPercent": 34 }
                },
                "glowStrength": 1.75,
                "glowPadding": 145,
                "whiteCoreSizePercent": 22,
                "whiteCoreBlurPercent": 14,
                "coreSoftness": 50,
                "coreBrightness": 60,
                "coreOpacityFalloff": 58,
                "glowSize": 88,
                "glowSoftness": 94,
                "glowOpacityFalloff": 100,
                "glowBlur": 44,
                "backgroundGlowOpacityFalloff": 77,
                "backgroundGlowSoftness": 52,
                "brightnessHoldPercent": 70,
                "brightnessHoldExponent": 1
              },
              "colourPattern": {
                "mode": "solid",
                "axis": "vertical",
                "count": 1,
                "colours": []
              },
              "burstTrail": {
                "version": 2,
                "enabled": true,
                "preset": "solidStreaks",
                "colourMode": "starFade",
                "particlesPerStar": 52,
                "frontClump": 0.58,
                "width": { "front": 1.1, "tail": 1.6, "curve": 1.05 },
                "particleSize": {
                  "base": 0.74,
                  "headScale": 1.05,
                  "tailScale": 0.32,
                  "variationPercent": 22
                },
                "opening": {
                  "size": { "startPercent": 100 },
                  "visibility": {
                    "brightnessPercent": 105,
                    "particlesPercent": 100,
                    "revealPercent": 15
                  }
                },
                "closing": {
                  "colour": {
                    "enabled": false,
                    "color": { "r": 1, "g": 0.34, "b": 0.08 },
                    "fadePercent": 22
                  },
                  "size": { "enabled": true, "endPercent": 0, "shrinkPercent": 32 },
                  "spreadFade": { "enabled": true, "startAngle": 44, "endOpacityPercent": 7 }
                },
                "placement": { "headGapPercent": 42 },
                "spacing": { "curve": 1.1, "jitterPercent": 18 },
                "lifetime": {
                  "mode": "dynamic",
                  "percent": 0.2,
                  "baseSeconds": 1.15,
                  "variationPercent": 24,
                  "afterglowSeconds": 0.22
                },
                "intensity": { "brightness": 1.12, "fadeSoftness": 1.05 },
                "flicker": { "chance": 0.08, "strength": 0.75, "lifetimeMultiplier": 0.45 },
                "motion": {
                  "gravity": -0.026,
                  "drag": 1.55,
                  "inheritedVelocity": 0.018,
                  "turbulence": 0.04,
                  "driftX": 0,
                  "driftY": -0.012,
                  "driftZ": 0,
                  "spin": 0
                },
                "stops": [
                  {
                    "position": 0,
                    "density": 1.4,
                    "size": 0.88,
                    "sizeVariation": 22,
                    "shapeWeights": { "circle": 6, "square": 90, "triangle": 4 }
                  },
                  {
                    "position": 55,
                    "density": 0.75,
                    "size": 0.56,
                    "sizeVariation": 28,
                    "shapeWeights": { "circle": 10, "square": 84, "triangle": 6 }
                  },
                  {
                    "position": 100,
                    "density": 0.16,
                    "size": 0.22,
                    "sizeVariation": 34,
                    "shapeWeights": { "circle": 20, "square": 76, "triangle": 4 }
                  }
                ]
              }
            },
            "core": {
              "enabled": true,
              "count": 60,
              "burst": {
                "speed": [0.75, 0.95],
                "gravity": [-0.07, -0.015],
                "life": [2.2, 3],
                "flairColorMode": "mixed"
              },
              "head": {
                "visible": true,
                "size": 155,
                "opening": {
                  "colour": {
                    "enabled": false,
                    "color": { "r": 1, "g": 0.42, "b": 0.08 },
                    "fadePercent": 24
                  },
                  "size": { "enabled": true, "startPercent": 36, "growPercent": 18 }
                },
                "closing": {
                  "colour": {
                    "enabled": false,
                    "color": { "r": 1, "g": 0.84, "b": 0.4 },
                    "fadePercent": 22
                  },
                  "size": { "enabled": true, "endPercent": 0, "shrinkPercent": 32 }
                },
                "glowStrength": 1.6,
                "glowPadding": 125,
                "whiteCoreSizePercent": 26,
                "whiteCoreBlurPercent": 13,
                "coreSoftness": 48,
                "coreBrightness": 64,
                "coreOpacityFalloff": 58,
                "glowSize": 84,
                "glowSoftness": 92,
                "glowOpacityFalloff": 100,
                "glowBlur": 38,
                "backgroundGlowOpacityFalloff": 80,
                "backgroundGlowSoftness": 56,
                "brightnessHoldPercent": 64,
                "brightnessHoldExponent": 0.95
              },
              "colourPattern": {
                "mode": "solid",
                "axis": "vertical",
                "count": 1,
                "colours": []
              },
              "burstTrail": {
                "version": 2,
                "enabled": true,
                "preset": "sparkDust",
                "colourMode": "star",
                "particlesPerStar": 18,
                "frontClump": 0.42,
                "width": { "front": 0.7, "tail": 1.3, "curve": 1.15 },
                "particleSize": {
                  "base": 0.48,
                  "headScale": 1,
                  "tailScale": 0.36,
                  "variationPercent": 45
                },
                "opening": {
                  "size": { "startPercent": 100 },
                  "visibility": {
                    "brightnessPercent": 100,
                    "particlesPercent": 78,
                    "revealPercent": 18
                  }
                },
                "closing": {
                  "colour": {
                    "enabled": false,
                    "color": { "r": 1, "g": 0.34, "b": 0.08 },
                    "fadePercent": 22
                  },
                  "size": { "enabled": true, "endPercent": 0, "shrinkPercent": 30 },
                  "spreadFade": { "enabled": true, "startAngle": 40, "endOpacityPercent": 5 }
                },
                "placement": { "headGapPercent": 32 },
                "spacing": { "curve": 1, "jitterPercent": 44 },
                "lifetime": {
                  "mode": "dynamic",
                  "percent": 0.14,
                  "baseSeconds": 0.72,
                  "variationPercent": 48,
                  "afterglowSeconds": 0.12
                },
                "intensity": { "brightness": 0.78, "fadeSoftness": 1.25 },
                "flicker": { "chance": 0.18, "strength": 0.68, "lifetimeMultiplier": 0.42 },
                "motion": {
                  "gravity": -0.04,
                  "drag": 2.25,
                  "inheritedVelocity": 0.016,
                  "turbulence": 0.12,
                  "driftX": 0,
                  "driftY": -0.016,
                  "driftZ": 0,
                  "spin": 0
                },
                "stops": [
                  {
                    "position": 0,
                    "density": 0.92,
                    "size": 0.52,
                    "sizeVariation": 46,
                    "shapeWeights": { "circle": 82, "square": 14, "triangle": 4 }
                  },
                  {
                    "position": 100,
                    "density": 0.14,
                    "size": 0.2,
                    "sizeVariation": 60,
                    "shapeWeights": { "circle": 92, "square": 6, "triangle": 2 }
                  }
                ]
              }
            }
          }
        }
      }
    }
  ]
  $effects$::jsonb) as effect(
    slug text,
    name text,
    description text,
    pattern_key text,
    sort_order integer,
    source text,
    model_json jsonb
  )
)
insert into public.firework_effects as existing (
  slug,
  name,
  description,
  pattern_key,
  model_json,
  sort_order,
  source
)
select
  slug,
  name,
  description,
  pattern_key,
  model_json,
  sort_order,
  source
from seeded_effects
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  pattern_key = excluded.pattern_key,
  model_json = excluded.model_json,
  sort_order = excluded.sort_order,
  source = excluded.source,
  updated_at = clock_timestamp()
where (
  existing.name,
  existing.description,
  existing.pattern_key,
  existing.model_json,
  existing.sort_order,
  existing.source
) is distinct from (
  excluded.name,
  excluded.description,
  excluded.pattern_key,
  excluded.model_json,
  excluded.sort_order,
  excluded.source
);
