create table if not exists public.firework_style_defaults (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  kind text not null,
  defaults_json jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint firework_style_defaults_kind_check check (kind in ('star', 'trail'))
);

alter table public.firework_effects
  add column if not exists star_style_default_id uuid references public.firework_style_defaults(id) on delete set null,
  add column if not exists trail_style_default_id uuid references public.firework_style_defaults(id) on delete set null;

alter table public.fireworks
  add column if not exists star_style_default_id uuid references public.firework_style_defaults(id) on delete set null,
  add column if not exists trail_style_default_id uuid references public.firework_style_defaults(id) on delete set null;

create index if not exists firework_style_defaults_kind_sort_idx
  on public.firework_style_defaults(kind, is_archived, sort_order, name);

create index if not exists firework_effects_star_style_default_id_idx
  on public.firework_effects(star_style_default_id);

create index if not exists firework_effects_trail_style_default_id_idx
  on public.firework_effects(trail_style_default_id);

create index if not exists fireworks_star_style_default_id_idx
  on public.fireworks(star_style_default_id);

create index if not exists fireworks_trail_style_default_id_idx
  on public.fireworks(trail_style_default_id);

grant select, insert, update, delete on public.firework_style_defaults to authenticated;

alter table public.firework_style_defaults enable row level security;

drop policy if exists "firework_style_defaults_select_authenticated" on public.firework_style_defaults;
create policy "firework_style_defaults_select_authenticated" on public.firework_style_defaults
  for select using (auth.uid() is not null);

drop policy if exists "firework_style_defaults_admin_modify" on public.firework_style_defaults;
create policy "firework_style_defaults_admin_modify" on public.firework_style_defaults
  for all using (public.current_user_has_permission('admin.manage_catalogue'))
  with check (public.current_user_has_permission('admin.manage_catalogue'));

drop trigger if exists firework_style_defaults_set_updated_at on public.firework_style_defaults;
create trigger firework_style_defaults_set_updated_at before update on public.firework_style_defaults
  for each row execute function public.set_updated_at();

with seeded_defaults(slug, name, description, kind, defaults_json, sort_order) as (
  values
    (
      'blue-sphere-stars',
      'Blue Sphere stars',
      'Calibrated star head defaults used by the Blue Sphere look.',
      'star',
      jsonb_build_object(
        'stars', jsonb_build_object(
          'outer', jsonb_build_object(
            'head', jsonb_build_object(
              'glowStrength', 1.5,
              'glowPadding', 150,
              'whiteCoreSizePercent', 20,
              'whiteCoreBlurPercent', 15,
              'coreSoftness', 55,
              'coreBrightness', 50,
              'coreOpacityFalloff', 60,
              'glowSize', 90,
              'glowSoftness', 100,
              'glowOpacityFalloff', 100,
              'glowBlur', 45,
              'backgroundGlowOpacityFalloff', 75,
              'backgroundGlowSoftness', 50
            )
          )
        )
      ),
      10
    ),
    (
      'spark-dust-trail',
      'Spark dust trail',
      'Loose, glittery dust behind each star.',
      'trail',
      '{"burstTrail":{"version":2,"preset":"sparkDust"}}'::jsonb,
      20
    ),
    (
      'solid-streaks-trail',
      'Solid streaks trail',
      'Classic clean streak particles behind each star.',
      'trail',
      '{"burstTrail":{"version":2,"preset":"solidStreaks"}}'::jsonb,
      30
    ),
    (
      'willow-hang-trail',
      'Willow hang trail',
      'Longer hanging trails for willow and falling effects.',
      'trail',
      '{"burstTrail":{"version":2,"preset":"willowHang"}}'::jsonb,
      40
    ),
    (
      'comet-tail-trail',
      'Comet tail trail',
      'Dense head-biased comet trails.',
      'trail',
      '{"burstTrail":{"version":2,"preset":"cometTail"}}'::jsonb,
      50
    ),
    (
      'dense-brocade-trail',
      'Dense brocade trail',
      'Fuller brocade-style streak trails.',
      'trail',
      '{"burstTrail":{"version":2,"preset":"denseBrocade"}}'::jsonb,
      60
    ),
    (
      'square-star-fade-trail',
      'Square star-fade trail',
      'Calibrated square trail that fades from star colour into ember.',
      'trail',
      jsonb_build_object(
        'burstTrail', jsonb_build_object(
          'version', 2,
          'enabled', true,
          'preset', 'custom',
          'colourMode', 'starFade',
          'particlesPerStar', 178,
          'frontClump', 0.55,
          'width', jsonb_build_object('front', 20, 'tail', 0, 'curve', 1),
          'particleSize', jsonb_build_object(
            'base', 1.2,
            'headScale', 1,
            'tailScale', 0.35,
            'variationPercent', 8
          ),
          'opening', jsonb_build_object(
            'size', jsonb_build_object('startPercent', 100),
            'visibility', jsonb_build_object(
              'brightnessPercent', 100,
              'particlesPercent', 100,
              'revealPercent', 24
            )
          ),
          'closing', jsonb_build_object(
            'colour', jsonb_build_object(
              'enabled', false,
              'color', jsonb_build_object('r', 1, 'g', 0.34, 'b', 0.08),
              'fadePercent', 22
            ),
            'size', jsonb_build_object(
              'enabled', false,
              'endPercent', 0,
              'shrinkPercent', 22
            ),
            'spreadFade', jsonb_build_object(
              'enabled', true,
              'startAngle', 60,
              'endOpacityPercent', 12
            )
          ),
          'placement', jsonb_build_object('headGapPercent', 60),
          'spacing', jsonb_build_object('curve', 1, 'jitterPercent', 18),
          'lifetime', jsonb_build_object(
            'mode', 'dynamic',
            'percent', 0.18,
            'baseSeconds', 8,
            'variationPercent', 30,
            'afterglowSeconds', 0.15
          ),
          'intensity', jsonb_build_object('brightness', 1, 'fadeSoftness', 1),
          'flicker', jsonb_build_object(
            'chance', 0.08,
            'strength', 0.8,
            'lifetimeMultiplier', 0.45
          ),
          'motion', jsonb_build_object(
            'gravity', -0.014,
            'drag', 1.6,
            'inheritedVelocity', 0.02,
            'turbulence', 0.045,
            'driftX', 0,
            'driftY', -0.012,
            'driftZ', 0,
            'spin', 0
          ),
          'stops', jsonb_build_array(
            jsonb_build_object(
              'position', 0,
              'density', 1,
              'size', 2.68,
              'sizeVariation', 0,
              'shapeWeights', jsonb_build_object('circle', 0, 'square', 100, 'triangle', 0)
            ),
            jsonb_build_object(
              'position', 100,
              'density', 1,
              'size', 0.08,
              'sizeVariation', 0,
              'shapeWeights', jsonb_build_object('circle', 0, 'square', 100, 'triangle', 0)
            )
          )
        )
      ),
      70
    )
)
insert into public.firework_style_defaults (
  slug,
  name,
  description,
  kind,
  defaults_json,
  sort_order
)
select slug, name, description, kind, defaults_json, sort_order
from seeded_defaults
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  defaults_json = excluded.defaults_json,
  sort_order = excluded.sort_order,
  is_archived = false,
  updated_at = now();

with blue_sphere(default_id, defaults) as (
  select
    id,
    defaults_json #> '{stars,outer,head}'
  from public.firework_style_defaults
  where slug = 'blue-sphere-stars'
)
update public.firework_effects fe
set
  star_style_default_id = blue_sphere.default_id,
  model_json = jsonb_set(
    fe.model_json,
    '{renderDefaults,stars}',
    (fe.model_json #> '{renderDefaults,stars}') - 'heads',
    true
  )
from blue_sphere
where fe.star_style_default_id is null
  and fe.model_json #> '{renderDefaults,stars,heads}' = blue_sphere.defaults;

with square_trail(default_id, defaults) as (
  select
    id,
    defaults_json -> 'burstTrail'
  from public.firework_style_defaults
  where slug = 'square-star-fade-trail'
)
update public.firework_effects fe
set
  trail_style_default_id = square_trail.default_id,
  model_json = jsonb_set(
    fe.model_json,
    '{renderDefaults}',
    (fe.model_json -> 'renderDefaults') - 'burstTrail',
    true
  )
from square_trail
where fe.trail_style_default_id is null
  and fe.model_json #> '{renderDefaults,burstTrail}' = square_trail.defaults;

with blue_sphere(default_id, defaults) as (
  select
    id,
    defaults_json #> '{stars,outer,head}'
  from public.firework_style_defaults
  where slug = 'blue-sphere-stars'
)
update public.fireworks fw
set
  star_style_default_id = blue_sphere.default_id,
  render_overrides_json = jsonb_set(
    fw.render_overrides_json,
    '{stars}',
    (fw.render_overrides_json -> 'stars') - 'heads',
    true
  )
from blue_sphere
where fw.star_style_default_id is null
  and fw.render_overrides_json #> '{stars,heads}' = blue_sphere.defaults;

with square_trail(default_id, defaults) as (
  select
    id,
    defaults_json -> 'burstTrail'
  from public.firework_style_defaults
  where slug = 'square-star-fade-trail'
)
update public.fireworks fw
set
  trail_style_default_id = square_trail.default_id,
  render_overrides_json = fw.render_overrides_json - 'burstTrail'
from square_trail
where fw.trail_style_default_id is null
  and fw.render_overrides_json -> 'burstTrail' = square_trail.defaults;

comment on table public.firework_style_defaults is
  'Reusable live renderer style defaults for firework stars and trails.';

comment on column public.firework_style_defaults.defaults_json is
  'Design-shaped renderer fragment merged before local effect or firework overrides.';

comment on column public.firework_effects.star_style_default_id is
  'Live star style defaults merged before this base effect model_json.';

comment on column public.firework_effects.trail_style_default_id is
  'Live trail style defaults merged before this base effect model_json.';

comment on column public.fireworks.star_style_default_id is
  'Live star style defaults merged before this firework render_overrides_json.';

comment on column public.fireworks.trail_style_default_id is
  'Live trail style defaults merged before this firework render_overrides_json.';
