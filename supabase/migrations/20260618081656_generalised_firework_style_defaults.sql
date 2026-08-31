alter table public.firework_style_defaults
  drop constraint if exists firework_style_defaults_kind_check;

alter table public.firework_style_defaults
  add constraint firework_style_defaults_kind_check
  check (kind in ('star', 'trail', 'launch', 'smoke', 'strobe', 'crackle', 'split', 'sound'));

create table if not exists public.firework_effect_style_default_links (
  firework_effect_id uuid not null references public.firework_effects(id) on delete cascade,
  kind text not null,
  style_default_id uuid not null references public.firework_style_defaults(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (firework_effect_id, kind),
  constraint firework_effect_style_default_links_kind_check
    check (kind in ('star', 'trail', 'launch', 'smoke', 'strobe', 'crackle', 'split', 'sound'))
);

create table if not exists public.firework_style_default_links (
  firework_id uuid not null references public.fireworks(id) on delete cascade,
  kind text not null,
  style_default_id uuid not null references public.firework_style_defaults(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (firework_id, kind),
  constraint firework_style_default_links_kind_check
    check (kind in ('star', 'trail', 'launch', 'smoke', 'strobe', 'crackle', 'split', 'sound'))
);

create index if not exists firework_effect_style_default_links_default_idx
  on public.firework_effect_style_default_links(style_default_id);

create index if not exists firework_style_default_links_default_idx
  on public.firework_style_default_links(style_default_id);

grant select, insert, update, delete on public.firework_effect_style_default_links to authenticated;
grant select, insert, update, delete on public.firework_style_default_links to authenticated;

alter table public.firework_effect_style_default_links enable row level security;
alter table public.firework_style_default_links enable row level security;

drop policy if exists "firework_effect_style_default_links_select_authenticated"
  on public.firework_effect_style_default_links;
create policy "firework_effect_style_default_links_select_authenticated"
  on public.firework_effect_style_default_links
  for select using (auth.uid() is not null);

drop policy if exists "firework_effect_style_default_links_admin_modify"
  on public.firework_effect_style_default_links;
create policy "firework_effect_style_default_links_admin_modify"
  on public.firework_effect_style_default_links
  for all using (public.current_user_has_permission('admin.manage_catalogue'))
  with check (public.current_user_has_permission('admin.manage_catalogue'));

drop policy if exists "firework_style_default_links_select_authenticated"
  on public.firework_style_default_links;
create policy "firework_style_default_links_select_authenticated"
  on public.firework_style_default_links
  for select using (auth.uid() is not null);

drop policy if exists "firework_style_default_links_admin_modify"
  on public.firework_style_default_links;
create policy "firework_style_default_links_admin_modify"
  on public.firework_style_default_links
  for all using (public.current_user_has_permission('admin.manage_catalogue'))
  with check (public.current_user_has_permission('admin.manage_catalogue'));

drop trigger if exists firework_effect_style_default_links_set_updated_at
  on public.firework_effect_style_default_links;
create trigger firework_effect_style_default_links_set_updated_at
  before update on public.firework_effect_style_default_links
  for each row execute function public.set_updated_at();

drop trigger if exists firework_style_default_links_set_updated_at
  on public.firework_style_default_links;
create trigger firework_style_default_links_set_updated_at
  before update on public.firework_style_default_links
  for each row execute function public.set_updated_at();

with seeded_defaults(slug, name, description, kind, defaults_json, sort_order) as (
  values
    (
      'standard-launch',
      'Standard launch',
      'Default lift speed, shell carrier, and lift-particle behaviour.',
      'launch',
      '{
        "liftVelocity": 15,
        "launch": {
          "shell": {
            "shape": "circle",
            "sizeScale": 1,
            "brightness": 1,
            "glowStrength": 1.5,
            "trail": { "tubeDiameter": 0, "frontAngle": 0, "tailAngle": 0, "curve": 1 }
          },
          "liftParticles": {
            "enabled": true,
            "amount": 100,
            "height": 100,
            "shapeWeights": { "circle": 0, "square": 100, "triangle": 0 },
            "particleSize": {
              "base": 30,
              "headScale": 1,
              "tailScale": 0.35,
              "variationPercent": 20
            },
            "frontClump": 0.55,
            "spacing": { "curve": 1, "jitterPercent": 35, "pathSamples": 5 },
            "lifetime": {
              "baseSeconds": 0.8,
              "variationPercent": 35,
              "afterglowSeconds": 0.1
            },
            "intensity": { "brightness": 1, "fadeSoftness": 1 },
            "flicker": { "chance": 0.08, "strength": 0.8, "lifetimeMultiplier": 0.45 },
            "motion": {
              "gravity": -0.09,
              "drag": 2.55,
              "inheritedVelocity": 0.02,
              "turbulence": 0.04,
              "driftX": 0,
              "driftY": -0.012,
              "driftZ": 0,
              "spin": 0,
              "swirlStrength": 0,
              "swirlRadius": 0,
              "swirlRate": 4
            }
          }
        }
      }'::jsonb,
      80
    ),
    (
      'standard-smoke',
      'Standard smoke',
      'Default launch smoke puffs and rise height.',
      'smoke',
      '{
        "launch": {
          "smoke": {
            "enabled": true,
            "particles": 100,
            "size": 86,
            "lifeSeconds": 3.2,
            "spread": 30,
            "drift": 1,
            "height": 360
          }
        },
        "mortar": { "smokeParticles": 100 }
      }'::jsonb,
      90
    ),
    (
      'standard-strobe',
      'Standard strobe',
      'Default blinking-star timing.',
      'strobe',
      '{"strobe":{"enabled":false,"frequencyHz":12,"dutyCycle":0.45}}'::jsonb,
      100
    ),
    (
      'standard-crackle',
      'Standard crackle',
      'Default crackle pop probability and sound.',
      'crackle',
      '{"crackle":{"enabled":true,"probability":0.05,"sound":"crackle"}}'::jsonb,
      110
    ),
    (
      'standard-split',
      'Standard split',
      'Default crossette split fragments and speed.',
      'split',
      '{"split":{"enabled":false,"fragments":4,"speed":1.55,"delayRatio":0.42}}'::jsonb,
      120
    ),
    (
      'standard-sound',
      'Standard sound',
      'Default launch and burst report behaviour.',
      'sound',
      '{"sound":{"launch":true,"boom":"auto"},"mortar":{"sound":true}}'::jsonb,
      130
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

insert into public.firework_effect_style_default_links (
  firework_effect_id,
  kind,
  style_default_id
)
select id, 'star', star_style_default_id
from public.firework_effects
where star_style_default_id is not null
on conflict (firework_effect_id, kind) do update
set style_default_id = excluded.style_default_id;

insert into public.firework_effect_style_default_links (
  firework_effect_id,
  kind,
  style_default_id
)
select id, 'trail', trail_style_default_id
from public.firework_effects
where trail_style_default_id is not null
on conflict (firework_effect_id, kind) do update
set style_default_id = excluded.style_default_id;

insert into public.firework_style_default_links (
  firework_id,
  kind,
  style_default_id
)
select id, 'star', star_style_default_id
from public.fireworks
where star_style_default_id is not null
on conflict (firework_id, kind) do update
set style_default_id = excluded.style_default_id;

insert into public.firework_style_default_links (
  firework_id,
  kind,
  style_default_id
)
select id, 'trail', trail_style_default_id
from public.fireworks
where trail_style_default_id is not null
on conflict (firework_id, kind) do update
set style_default_id = excluded.style_default_id;

comment on table public.firework_effect_style_default_links is
  'Live renderer style-default links attached to colourless base firework effects.';

comment on table public.firework_style_default_links is
  'Live renderer style-default links attached to individual fireworks.';
