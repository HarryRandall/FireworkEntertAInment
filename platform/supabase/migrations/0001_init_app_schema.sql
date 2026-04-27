-- ShowCrafter app schema
-- Profiles mirror auth.users; shows are user-scoped; cues + shopping_list_items are show-scoped.
-- All tables RLS-enabled. Storage bucket `audio` is private with per-user prefix policies.

create extension if not exists "pgcrypto";

-- Reusable updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── profiles ─────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-populate profile on signup from raw_user_meta_data.full_name
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── shows ────────────────────────────────────────────────────────
create table if not exists public.shows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null,
  title text not null,
  song text,
  artist text,
  status text not null default 'draft' check (status in ('draft','complete')),
  duration_seconds integer,
  budget_cents integer,
  total_cents integer not null default 0,
  effects_count integer not null default 0,
  sync_percent numeric(5,2),
  safety_meters integer,
  time_of_day text,
  location text,
  description text,
  mood_tags text[] not null default '{}',
  audio_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);

create index if not exists shows_user_id_idx on public.shows (user_id, updated_at desc);

alter table public.shows enable row level security;

drop policy if exists "shows_select_own" on public.shows;
create policy "shows_select_own" on public.shows
  for select using (auth.uid() = user_id);

drop policy if exists "shows_insert_own" on public.shows;
create policy "shows_insert_own" on public.shows
  for insert with check (auth.uid() = user_id);

drop policy if exists "shows_update_own" on public.shows;
create policy "shows_update_own" on public.shows
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "shows_delete_own" on public.shows;
create policy "shows_delete_own" on public.shows
  for delete using (auth.uid() = user_id);

drop trigger if exists shows_set_updated_at on public.shows;
create trigger shows_set_updated_at
  before update on public.shows
  for each row execute function public.set_updated_at();

-- ─── show_cues ────────────────────────────────────────────────────
create table if not exists public.show_cues (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows(id) on delete cascade,
  position integer not null default 0,
  time_seconds numeric(8,2),
  description text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists show_cues_show_id_idx on public.show_cues (show_id, position);

alter table public.show_cues enable row level security;

drop policy if exists "show_cues_select_via_show" on public.show_cues;
create policy "show_cues_select_via_show" on public.show_cues
  for select using (
    exists (select 1 from public.shows s where s.id = show_id and s.user_id = auth.uid())
  );

drop policy if exists "show_cues_modify_via_show" on public.show_cues;
create policy "show_cues_modify_via_show" on public.show_cues
  for all using (
    exists (select 1 from public.shows s where s.id = show_id and s.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.shows s where s.id = show_id and s.user_id = auth.uid())
  );

drop trigger if exists show_cues_set_updated_at on public.show_cues;
create trigger show_cues_set_updated_at
  before update on public.show_cues
  for each row execute function public.set_updated_at();

-- ─── shopping_list_items ──────────────────────────────────────────
create table if not exists public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows(id) on delete cascade,
  position integer not null default 0,
  name text not null,
  qty integer not null default 1 check (qty >= 0),
  price_cents integer not null default 0 check (price_cents >= 0),
  firework_part_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shopping_list_items_show_id_idx on public.shopping_list_items (show_id, position);

alter table public.shopping_list_items enable row level security;

drop policy if exists "shopping_list_items_select_via_show" on public.shopping_list_items;
create policy "shopping_list_items_select_via_show" on public.shopping_list_items
  for select using (
    exists (select 1 from public.shows s where s.id = show_id and s.user_id = auth.uid())
  );

drop policy if exists "shopping_list_items_modify_via_show" on public.shopping_list_items;
create policy "shopping_list_items_modify_via_show" on public.shopping_list_items
  for all using (
    exists (select 1 from public.shows s where s.id = show_id and s.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.shows s where s.id = show_id and s.user_id = auth.uid())
  );

drop trigger if exists shopping_list_items_set_updated_at on public.shopping_list_items;
create trigger shopping_list_items_set_updated_at
  before update on public.shopping_list_items
  for each row execute function public.set_updated_at();

-- ─── audio storage bucket + per-user prefix policies ──────────────
insert into storage.buckets (id, name, public)
values ('audio', 'audio', false)
on conflict (id) do nothing;

drop policy if exists "audio_read_own" on storage.objects;
create policy "audio_read_own" on storage.objects
  for select using (
    bucket_id = 'audio'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "audio_insert_own" on storage.objects;
create policy "audio_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'audio'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "audio_update_own" on storage.objects;
create policy "audio_update_own" on storage.objects
  for update using (
    bucket_id = 'audio'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "audio_delete_own" on storage.objects;
create policy "audio_delete_own" on storage.objects
  for delete using (
    bucket_id = 'audio'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );
