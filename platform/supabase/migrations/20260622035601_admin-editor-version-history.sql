create table if not exists public.firework_editor_versions (
  id uuid primary key default gen_random_uuid(),
  target_kind text not null,
  firework_id uuid references public.fireworks(id) on delete cascade,
  firework_effect_id uuid references public.firework_effects(id) on delete cascade,
  action text not null,
  summary text not null,
  snapshot_json jsonb not null,
  previous_snapshot_json jsonb,
  changes_json jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_by_label text not null,
  created_at timestamptz not null default now(),
  constraint firework_editor_versions_target_kind_check
    check (target_kind in ('firework', 'effect')),
  constraint firework_editor_versions_action_check
    check (action in ('update', 'restore')),
  constraint firework_editor_versions_target_fk_check
    check (
      (target_kind = 'firework' and firework_id is not null and firework_effect_id is null)
      or
      (target_kind = 'effect' and firework_effect_id is not null and firework_id is null)
    )
);

comment on table public.firework_editor_versions is
  'Immutable admin editor version history for fireworks and base firework effects.';
comment on column public.firework_editor_versions.snapshot_json is
  'Canonical editor snapshot after the recorded action.';
comment on column public.firework_editor_versions.previous_snapshot_json is
  'Canonical editor snapshot before the recorded action, when available.';
comment on column public.firework_editor_versions.changes_json is
  'Small machine-readable summary of fields changed by the action.';

create index if not exists firework_editor_versions_firework_created_at_idx
  on public.firework_editor_versions (firework_id, created_at desc);

create index if not exists firework_editor_versions_effect_created_at_idx
  on public.firework_editor_versions (firework_effect_id, created_at desc);

grant select, insert on public.firework_editor_versions to authenticated;

alter table public.firework_editor_versions enable row level security;

create policy "firework_editor_versions_admin_select"
  on public.firework_editor_versions
  for select
  using (public.current_user_has_permission('admin.manage_catalogue'));

create policy "firework_editor_versions_admin_insert"
  on public.firework_editor_versions
  for insert
  with check (public.current_user_has_permission('admin.manage_catalogue'));
