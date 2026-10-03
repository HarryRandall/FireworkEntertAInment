-- Stored catalogue test documents copied from the validated renderer fixture.
create function tests.design_fixture() returns jsonb language sql immutable set search_path = '' as $$ select $doc${
  "kind": "shell",
  "launch": {
    "height_m": 56,
    "time_s": 1.7389652095,
    "tilt_deg": 0,
    "tail": "gold",
    "sparks": 180,
    "spread": 1.4,
    "smoke": 1
  },
  "breaks": [
    {
      "at_s": 0,
      "core": {
        "enabled": true,
        "colour": "#ff3b2f",
        "count": 110,
        "radius": 0.5,
        "flash": 1,
        "flash_on": true,
        "ring": false
      },
      "fade": { "white_hot": 0.03, "ember_at": 0.8, "fade_at": 0.72, "prime_s": 0.25 },
      "layers": [
        {
          "id": "petals",
          "name": "Red and green petals",
          "pattern": "sphere",
          "count": 90,
          "radius_m": 26,
          "tilt": 0.4,
          "speed_var": 0.22,
          "drag_per_s": 2.6,
          "gravity_m_s2": 9,
          "life_s": 2.2,
          "life_var": 0.2,
          "delay_s": 0,
          "offset_m": [0, 0, 0],
          "flash": true,
          "hidden": false,
          "colour": {
            "mode": "alternate",
            "stops": [
              [0, ["#ff3048", "#2fe06a"]],
              [1, ["#ff3048", "#2fe06a"]]
            ]
          },
          "brightness": [
            [0, 1.5],
            [1, 1.5]
          ],
          "head": { "size": 1.1, "visible": true, "halo": 1 },
          "trail": {
            "sparks": 10,
            "length_s": 0.25,
            "spread_m_s": 0.4,
            "gravity_m_s2": 3,
            "drag_per_s": 2.6,
            "size": 1,
            "flicker": 0.3,
            "colour": "star",
            "glitter": 0,
            "glitter_delay_s": 0.35,
            "fork": 0
          },
          "modifiers": []
        }
      ]
    }
  ],
  "ground": null,
  "sound": { "lift": 0.7, "break": 0.85, "crackle": 0.6, "whistle": 0 },
  "seed": 11
}$doc$::jsonb; $$;
create function tests.composition_fixture() returns jsonb language sql immutable set search_path = '' as $$ select '{"tubes":[{"i":0,"letter":"a","t_ms":0,"angle_deg":0}]}'::jsonb; $$;
