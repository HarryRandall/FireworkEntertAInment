-- Recommended show templates and faster current-user access lookup.

create or replace function public.current_user_access()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with current_profile as (
    select id, email, full_name, phone, status
    from public.profiles
    where id = auth.uid()
  ),
  assigned_roles as (
    select r.id, r.key, r.name
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
  ),
  role_grants as (
    select distinct p.key
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = auth.uid()
  ),
  overrides as (
    select p.key, upo.enabled
    from public.user_permission_overrides upo
    join public.permissions p on p.id = upo.permission_id
    where upo.user_id = auth.uid()
  ),
  final_permissions as (
    select key from role_grants
    where key not in (select key from overrides where enabled = false)
    union
    select key from overrides where enabled = true
  )
  select jsonb_build_object(
    'profile', coalesce((select to_jsonb(current_profile) from current_profile), '{}'::jsonb),
    'roles', coalesce((select jsonb_agg(key order by key) from assigned_roles), '[]'::jsonb),
    'permissions', coalesce((select jsonb_agg(key order by key) from final_permissions), '[]'::jsonb)
  );
$$;

create table if not exists public.show_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  theme text not null,
  description text,
  duration_seconds integer,
  budget_cents integer,
  total_cents integer not null default 0,
  effects_count integer not null default 0,
  time_of_day text,
  mood_tags text[] not null default '{}',
  preview_cues jsonb not null default '[]'::jsonb,
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists show_templates_featured_idx
  on public.show_templates (is_featured desc, sort_order, title);

alter table public.show_templates enable row level security;

drop policy if exists "show_templates_read_authenticated" on public.show_templates;
create policy "show_templates_read_authenticated" on public.show_templates
  for select using (auth.uid() is not null);

drop policy if exists "show_templates_admin_modify" on public.show_templates;
create policy "show_templates_admin_modify" on public.show_templates
  for all using (public.current_user_has_permission('admin.manage_catalogue'))
  with check (public.current_user_has_permission('admin.manage_catalogue'));

drop trigger if exists show_templates_set_updated_at on public.show_templates;
create trigger show_templates_set_updated_at before update on public.show_templates
  for each row execute function public.set_updated_at();

insert into public.show_templates (
  slug,
  title,
  theme,
  description,
  duration_seconds,
  budget_cents,
  total_cents,
  effects_count,
  time_of_day,
  mood_tags,
  preview_cues,
  is_featured,
  sort_order
)
values
  (
    'golden-finale',
    'Golden Finale',
    'Elegant gold crescendo',
    'A compact three-minute show built around warm gold willows and a dense final barrage.',
    180,
    250000,
    218000,
    42,
    'Night',
    array['Elegant', 'Grand finale focused'],
    '[
      {"timeSeconds": 8, "description": "Opening comet lift", "fireworkSlug": "comet"},
      {"timeSeconds": 38, "description": "Gold willow layer", "fireworkSlug": "willow"},
      {"timeSeconds": 92, "description": "Peony accents", "fireworkSlug": "peony"},
      {"timeSeconds": 160, "description": "Final barrage", "fireworkSlug": "finale_barrage"}
    ]'::jsonb,
    true,
    10
  ),
  (
    'patriotic-skyline',
    'Patriotic Skyline',
    'Red, white, and blue celebration',
    'A bright, direct show with blue comets, red peonies, and a clean white finale.',
    150,
    180000,
    164000,
    36,
    'Dusk',
    array['Patriotic', 'High energy'],
    '[
      {"timeSeconds": 6, "description": "Blue comet fan", "fireworkSlug": "comet"},
      {"timeSeconds": 34, "description": "Red peony hits", "fireworkSlug": "peony"},
      {"timeSeconds": 78, "description": "Chrysanthemum centre", "fireworkSlug": "chrysanthemum"},
      {"timeSeconds": 132, "description": "White finale", "fireworkSlug": "finale_barrage"}
    ]'::jsonb,
    true,
    20
  ),
  (
    'midnight-minimal',
    'Midnight Minimal',
    'Sparse cinematic pulses',
    'A lower-cost atmospheric template with isolated comets and slow-hanging willows.',
    120,
    90000,
    76000,
    18,
    'Night',
    array['Minimalist', 'Romantic'],
    '[
      {"timeSeconds": 10, "description": "Single sky comet", "fireworkSlug": "comet"},
      {"timeSeconds": 42, "description": "Low peony pulse", "fireworkSlug": "peony"},
      {"timeSeconds": 88, "description": "Golden willow finish", "fireworkSlug": "willow"}
    ]'::jsonb,
    true,
    30
  )
on conflict (slug) do update
set title = excluded.title,
    theme = excluded.theme,
    description = excluded.description,
    duration_seconds = excluded.duration_seconds,
    budget_cents = excluded.budget_cents,
    total_cents = excluded.total_cents,
    effects_count = excluded.effects_count,
    time_of_day = excluded.time_of_day,
    mood_tags = excluded.mood_tags,
    preview_cues = excluded.preview_cues,
    is_featured = excluded.is_featured,
    sort_order = excluded.sort_order;

revoke execute on function public.current_user_access() from public;
grant execute on function public.current_user_access() to authenticated;
