-- Firework effect spec v2 persistence.
-- Core product/show fields stay queryable; render details remain flexible JSONB.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  manufacturer text,
  product_code text,
  category text,
  subtype text,
  description text,
  vdl_like_description text,
  tags text[] not null default '{}',
  shot_count integer check (shot_count is null or shot_count >= 0),
  duration_seconds numeric(8,2) check (duration_seconds is null or duration_seconds >= 0),
  caliber text,
  height_meters numeric(8,2) check (height_meters is null or height_meters >= 0),
  width_meters numeric(8,2) check (width_meters is null or width_meters >= 0),
  safety_distance_meters numeric(8,2) check (safety_distance_meters is null or safety_distance_meters >= 0),
  product_dimensions jsonb not null default '{}'::jsonb,
  default_effect_spec_id uuid,
  media_references jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.effect_specs (
  id uuid primary key default gen_random_uuid(),
  version integer not null default 2 check (version = 2),
  slug text not null unique,
  name text not null,
  description text,
  type text not null,
  duration_seconds numeric(8,2) not null,
  shot_count integer not null default 1,
  height_meters numeric(8,2),
  source text not null check (source in ('manual', 'video_inferred', 'llm_generated', 'catalogue', 'legacy_migrated')),
  confidence numeric(4,3) not null default 1 check (confidence >= 0 and confidence <= 1),
  spec_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products
  add constraint products_default_effect_spec_id_fkey
  foreign key (default_effect_spec_id)
  references public.effect_specs(id)
  on delete set null;

alter table public.show_cues
  add column if not exists firework_product_id uuid references public.products(id) on delete set null,
  add column if not exists effect_spec_id uuid references public.effect_specs(id) on delete set null,
  add column if not exists position_json jsonb not null default '{"x":0,"y":0,"z":0}'::jsonb,
  add column if not exists rotation_json jsonb not null default '{"pan":0,"tilt":90,"roll":0}'::jsonb,
  add column if not exists scale numeric(8,3) not null default 1,
  add column if not exists overrides_json jsonb not null default '{}'::jsonb,
  add column if not exists label text,
  add column if not exists locked boolean not null default false,
  add column if not exists track text,
  add column if not exists layer text,
  add column if not exists seed_override integer;

create table if not exists public.inferred_video_observations (
  id uuid primary key default gen_random_uuid(),
  video_id uuid references public.media_assets(id) on delete set null,
  effect_spec_id uuid references public.effect_specs(id) on delete cascade,
  observation_json jsonb not null,
  confidence numeric(4,3) not null default 0.5 check (confidence >= 0 and confidence <= 1),
  created_at timestamptz not null default now()
);

create index if not exists effect_specs_type_idx on public.effect_specs (type, name);
create index if not exists effect_specs_source_idx on public.effect_specs (source, confidence desc);
create index if not exists products_product_code_idx on public.products (product_code);
create index if not exists show_cues_effect_spec_id_idx on public.show_cues (effect_spec_id);
create index if not exists inferred_video_observations_effect_spec_id_idx
  on public.inferred_video_observations (effect_spec_id, created_at desc);

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

drop trigger if exists effect_specs_set_updated_at on public.effect_specs;
create trigger effect_specs_set_updated_at
  before update on public.effect_specs
  for each row execute function public.set_updated_at();

alter table public.products enable row level security;
alter table public.effect_specs enable row level security;
alter table public.inferred_video_observations enable row level security;

drop policy if exists "products_read_all" on public.products;
create policy "products_read_all" on public.products for select using (true);

drop policy if exists "effect_specs_read_all" on public.effect_specs;
create policy "effect_specs_read_all" on public.effect_specs for select using (true);

drop policy if exists "effect_specs_admin_write" on public.effect_specs;
create policy "effect_specs_admin_write" on public.effect_specs
  for all using (public.current_user_has_permission('admin.manage_catalogue'))
  with check (public.current_user_has_permission('admin.manage_catalogue'));

drop policy if exists "products_admin_write" on public.products;
create policy "products_admin_write" on public.products
  for all using (public.current_user_has_permission('admin.manage_catalogue'))
  with check (public.current_user_has_permission('admin.manage_catalogue'));

drop policy if exists "inferred_video_observations_admin" on public.inferred_video_observations;
create policy "inferred_video_observations_admin" on public.inferred_video_observations
  for all using (public.current_user_has_permission('admin.manage_imports'))
  with check (public.current_user_has_permission('admin.manage_imports'));

with presets(slug, name, type, shot_count, duration_seconds, height_meters, colors) as (
  values
    ('red-peony', 'Red Peony', 'shell', 1, 4.6, 88, array['#ff3b2f','#ff9a7a','#3a0402']),
    ('blue-peony-silver-glitter', 'Blue Peony with Silver Glitter', 'shell', 1, 4.8, 88, array['#4aa3ff','#dbeafe','#ffffff']),
    ('gold-chrysanthemum', 'Gold Chrysanthemum', 'shell', 1, 5.0, 92, array['#ffd36a','#fff2b0','#b56a18']),
    ('willow', 'Willow', 'shell', 1, 6.2, 90, array['#ffd36a','#c88932','#3b1f0a']),
    ('brocade-crown', 'Brocade Crown', 'shell', 1, 5.8, 92, array['#fff2b0','#ffd36a','#9c5a17']),
    ('palm', 'Palm', 'shell', 1, 4.8, 86, array['#ffc857','#fff7d6','#5c2d0c']),
    ('ring-shell', 'Ring Shell', 'shell', 1, 4.4, 84, array['#ff4d6d','#ffffff','#42101a']),
    ('double-ring', 'Double Ring', 'shell', 1, 4.6, 86, array['#ff3b2f','#4aa3ff','#ffffff']),
    ('heart-shell', 'Heart Shell', 'shell', 1, 4.7, 84, array['#ff2d55','#ffffff','#3d0714']),
    ('crossette', 'Crossette', 'shell', 1, 4.5, 86, array['#ff7a18','#fff2b0','#ffffff']),
    ('crackle-chrysanthemum', 'Crackle Chrysanthemum', 'shell', 1, 5.0, 90, array['#ffd36a','#ffffff','#f97316']),
    ('strobe-shell', 'Strobe Shell', 'shell', 1, 4.8, 84, array['#ffffff','#e0f2fe','#64748b']),
    ('falling-leaves', 'Falling Leaves', 'shell', 1, 6.0, 76, array['#ffdf80','#ff7a18','#7c2d12']),
    ('horsetail', 'Horsetail', 'shell', 1, 5.7, 88, array['#ffd36a','#f59e0b','#3b1f0a']),
    ('fish-bees', 'Fish/Bees', 'shell', 1, 4.1, 78, array['#7dd3fc','#ffffff','#fef08a']),
    ('red-mine', 'Red Mine', 'mine', 1, 2.6, 24, array['#ff3b2f','#ffb4a8','#3a0402']),
    ('gold-comet', 'Gold Comet', 'comet', 1, 3.0, 58, array['#ffd36a','#fff2b0','#b56a18']),
    ('mine-to-peony', 'Mine to Peony', 'combo', 1, 4.6, 82, array['#ff3b2f','#4aa3ff','#ffffff']),
    ('fanned-cake', 'Fanned Cake', 'cake', 9, 8.6, 64, array['#ff3b2f','#ffd36a','#4aa3ff']),
    ('zipper-cake', 'Zipper Cake', 'cake', 16, 7.4, 64, array['#4aa3ff','#ffffff','#ffd36a']),
    ('w-shape-cake', 'W-Shape Cake', 'cake', 15, 9.2, 64, array['#ffd36a','#ff3b2f','#ffffff']),
    ('reloadable-shell-kit', 'Reloadable Shell Kit Sequence', 'cake', 6, 15.2, 88, array['#ff3b2f','#4aa3ff','#ffd36a','#ffffff']),
    ('finale-volley', 'Finale Volley', 'cake', 24, 6.4, 78, array['#ff3b2f','#ffd36a','#4aa3ff','#ffffff']),
    ('lace-glitter-cake', 'Lace + Glitter Cake', 'cake', 18, 11.7, 68, array['#ffffff','#ffd36a','#9c5a17'])
)
insert into public.effect_specs (
  slug,
  name,
  description,
  type,
  duration_seconds,
  shot_count,
  height_meters,
  source,
  confidence,
  spec_json
)
select
  slug,
  name,
  'Seed v2 procedural preset. Full editable presets are mirrored in lib/fireworks/effectPresets.ts.',
  type,
  duration_seconds,
  shot_count,
  height_meters,
  'catalogue',
  1,
  jsonb_build_object(
    'version', 2,
    'name', name,
    'description', 'Seed v2 procedural preset.',
    'source', 'catalogue',
    'confidence', 1,
    'seed', abs(('x' || substr(md5(slug), 1, 8))::bit(32)::int),
    'type', type,
    'durationSeconds', duration_seconds,
    'heightMeters', height_meters,
    'colorPalette', to_jsonb(colors),
    'shotSequence', jsonb_build_object(
      'shotCount', shot_count,
      'durationSeconds', greatest(duration_seconds - 3, 0),
      'cadenceMode', case when shot_count > 1 then 'even' else 'custom' end,
      'firingPattern', case when type = 'cake' then 'FNR' else 'STR' end,
      'shots', '[]'::jsonb
    ),
    'effectLayers', '[]'::jsonb,
    'metadata', jsonb_build_object('seededByMigration', '0009_firework_effect_spec_v2')
  )
from presets
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  type = excluded.type,
  duration_seconds = excluded.duration_seconds,
  shot_count = excluded.shot_count,
  height_meters = excluded.height_meters,
  source = excluded.source,
  confidence = excluded.confidence,
  spec_json = excluded.spec_json;
