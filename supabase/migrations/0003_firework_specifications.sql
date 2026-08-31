-- Data-driven firework preview catalogue.
-- Specs are shared and read-only to app users; show_cues remain scoped through shows.

create table if not exists public.firework_specifications (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  sort_order integer not null default 0,
  spec jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists firework_specifications_sort_order_idx
  on public.firework_specifications (sort_order, name);

alter table public.firework_specifications enable row level security;

drop policy if exists "firework_specifications_read_all" on public.firework_specifications;
create policy "firework_specifications_read_all" on public.firework_specifications
  for select using (true);

drop trigger if exists firework_specifications_set_updated_at on public.firework_specifications;
create trigger firework_specifications_set_updated_at
  before update on public.firework_specifications
  for each row execute function public.set_updated_at();

insert into public.firework_specifications (slug, name, description, sort_order, spec)
values
  (
    'peony',
    'Peony Burst',
    'Classic spherical break with bright, even stars.',
    10,
    '{
      "particleCount": 240,
      "burstDuration": 2.4,
      "colors": ["#ffc174", "#ffe6b8", "#f59e0b"],
      "spread": 2.6,
      "launchHeight": 2.8,
      "gravity": -1.5,
      "drag": 0.86,
      "sparkSize": 0.075,
      "trailLength": 0.65
    }'::jsonb
  ),
  (
    'chrysanthemum',
    'Chrysanthemum',
    'Dense layered burst with a fuller crown and softer fade.',
    20,
    '{
      "particleCount": 320,
      "burstDuration": 2.8,
      "colors": ["#ffc174", "#ffddb8", "#e5e2e1"],
      "spread": 3.1,
      "launchHeight": 3.4,
      "gravity": -1.35,
      "drag": 0.82,
      "sparkSize": 0.07,
      "trailLength": 0.8
    }'::jsonb
  ),
  (
    'willow',
    'Golden Willow',
    'Slow cascading trails that hang and fall like embers.',
    30,
    '{
      "particleCount": 280,
      "burstDuration": 3.8,
      "colors": ["#ffc174", "#f0bd82", "#ffb95f"],
      "spread": 2.4,
      "launchHeight": 3.2,
      "gravity": -2.2,
      "drag": 0.72,
      "sparkSize": 0.065,
      "trailLength": 1.15
    }'::jsonb
  ),
  (
    'comet',
    'Sky Comet',
    'Fast ascending comet with a compact crackling tail.',
    40,
    '{
      "particleCount": 140,
      "burstDuration": 1.8,
      "colors": ["#8fd5ff", "#c5e7ff", "#ffc174"],
      "spread": 1.6,
      "launchHeight": 4.0,
      "gravity": -1.2,
      "drag": 0.9,
      "sparkSize": 0.08,
      "trailLength": 0.45
    }'::jsonb
  ),
  (
    'finale_barrage',
    'Finale Barrage',
    'High-energy multi-break finale with heavier particle density.',
    50,
    '{
      "particleCount": 460,
      "burstDuration": 3.0,
      "colors": ["#ffc174", "#f59e0b", "#ffddb8", "#8fd5ff"],
      "spread": 3.6,
      "launchHeight": 3.6,
      "gravity": -1.65,
      "drag": 0.8,
      "sparkSize": 0.085,
      "trailLength": 0.7,
      "secondaryBursts": 3
    }'::jsonb
  )
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  spec = excluded.spec;

alter table public.show_cues
  add column if not exists firework_specification_id uuid
    references public.firework_specifications(id) on delete set null,
  add column if not exists render_params jsonb;

create index if not exists show_cues_firework_specification_id_idx
  on public.show_cues (firework_specification_id);
