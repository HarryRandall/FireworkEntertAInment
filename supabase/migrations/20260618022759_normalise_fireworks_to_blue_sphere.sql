-- Normalise all current base effects and concrete fireworks to the Blue Sphere
-- renderer shape. Firework colours remain on the firework rows; every other
-- render setting is reset to the same clean fibonacci sphere.

create or replace function pg_temp.showcrafter_hex_channel(hex text, offset_index integer)
returns numeric
language sql
immutable
as $$
  select round(
    (
      (
        (strpos('0123456789abcdef', substr(lower(hex), offset_index, 1)) - 1) * 16
        + (strpos('0123456789abcdef', substr(lower(hex), offset_index + 1, 1)) - 1)
      )::numeric / 255
    ),
    4
  );
$$;

create or replace function pg_temp.showcrafter_hex_to_rgb(hex text)
returns jsonb
language sql
immutable
as $$
  select case
    when hex ~* '^#[0-9a-f]{6}$' then jsonb_build_object(
      'r', pg_temp.showcrafter_hex_channel(hex, 2),
      'g', pg_temp.showcrafter_hex_channel(hex, 4),
      'b', pg_temp.showcrafter_hex_channel(hex, 6)
    )
    else null
  end;
$$;

create or replace function pg_temp.showcrafter_blue_sphere_design()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'colour', jsonb_build_object('enabled', true),
    'size', 180,
    'pattern', 'fibonacci',
    'geometry', 'sphere',
    'trailProfile', 'none',
    'burst', jsonb_build_object(
      'speed', jsonb_build_array(2.2, 3.8),
      'gravity', jsonb_build_array(-1.3, -0.1),
      'life', jsonb_build_array(0.6, 4.5),
      'flairColorMode', 'mixed'
    ),
    'flair', jsonb_build_object('enabled', true),
    'crackle', jsonb_build_object(
      'enabled', false,
      'probability', 0,
      'sound', 'crackle'
    ),
    'sound', jsonb_build_object(
      'launch', true,
      'boom', 'light'
    ),
    'strobe', jsonb_build_object('enabled', false),
    'split', jsonb_build_object('enabled', false),
    'trail', jsonb_build_object(
      'density', 0,
      'length', 0.35,
      'sparkle', 0,
      'thickness', 0.6,
      'streakSize', 1,
      'streakLength', 1,
      'streakLife', 1
    ),
    'burstTrail', jsonb_build_object(
      'enabled', false,
      'preset', 'none',
      'particlesPerStar', 0
    ),
    'mortar', jsonb_build_object(
      'sound', true,
      'smokeParticles', 90
    ),
    'launch', jsonb_build_object(
      'liftParticles', jsonb_build_object(
        'enabled', true,
        'amount', 100,
        'spacing', jsonb_build_object('pathSamples', 5),
        'motion', jsonb_build_object(
          'swirlStrength', 0,
          'swirlRadius', 0,
          'swirlRate', 4
        )
      ),
      'smoke', jsonb_build_object(
        'enabled', true,
        'particles', 90
      )
    ),
    'stars', jsonb_build_object(
      'outer', jsonb_build_object(
        'enabled', true,
        'count', 100,
        'burst', jsonb_build_object(
          'speed', jsonb_build_array(2.2, 3.8),
          'gravity', jsonb_build_array(-1.3, -0.1),
          'life', jsonb_build_array(0.6, 4.5),
          'flairColorMode', 'mixed'
        ),
        'burstTrail', jsonb_build_object(
          'enabled', false,
          'preset', 'none',
          'particlesPerStar', 0
        )
      ),
      'core', jsonb_build_object('enabled', false)
    ),
    'brocade', jsonb_build_object('headsEnabled', false)
  );
$$;

create or replace function pg_temp.showcrafter_blue_sphere_effect_model()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'version', 3,
    'geometry', 'sphere',
    'trailProfile', 'none',
    'renderDefaults', pg_temp.showcrafter_blue_sphere_design()
  );
$$;

create or replace function pg_temp.showcrafter_firework_colour(
  primary_color text,
  render_overrides jsonb
)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    pg_temp.showcrafter_hex_to_rgb(primary_color),
    case
      when jsonb_typeof(render_overrides #> '{stars,outer,color}') in ('object', 'string')
        then render_overrides #> '{stars,outer,color}'
      else null
    end,
    case
      when jsonb_typeof(render_overrides -> 'color') in ('object', 'string')
        then render_overrides -> 'color'
      else null
    end
  );
$$;

create or replace function pg_temp.showcrafter_apply_firework_colour(
  defaults jsonb,
  colour jsonb
)
returns jsonb
language sql
immutable
as $$
  select case
    when colour is null then defaults
    else jsonb_set(
      defaults || jsonb_build_object('color', colour),
      '{stars,outer,color}',
      colour,
      true
    )
  end;
$$;

update public.firework_effects
set
  pattern_key = 'fibonacci',
  model_json = pg_temp.showcrafter_blue_sphere_effect_model(),
  updated_at = now();

update public.fireworks
set
  render_overrides_json = pg_temp.showcrafter_apply_firework_colour(
    pg_temp.showcrafter_blue_sphere_design(),
    pg_temp.showcrafter_firework_colour(primary_color, render_overrides_json)
  ),
  updated_at = now();
