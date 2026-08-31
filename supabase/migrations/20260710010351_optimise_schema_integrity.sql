-- Add the foreign-key indexes reported by the linked database advisor. Nullable
-- audit references use partial indexes so normal rows do not bloat them.
create index if not exists ai_credit_costs_updated_by_idx
  on public.ai_credit_costs (updated_by)
  where updated_by is not null;

create index if not exists ai_credit_transactions_created_by_idx
  on public.ai_credit_transactions (created_by)
  where created_by is not null;

create index if not exists firework_editor_versions_created_by_idx
  on public.firework_editor_versions (created_by)
  where created_by is not null;

create index if not exists generation_settings_updated_by_idx
  on public.generation_settings (updated_by)
  where updated_by is not null;

create index if not exists import_jobs_created_by_idx
  on public.import_jobs (created_by)
  where created_by is not null;

create index if not exists import_jobs_media_asset_id_idx
  on public.import_jobs (media_asset_id)
  where media_asset_id is not null;

create index if not exists media_assets_owner_id_idx
  on public.media_assets (owner_id)
  where owner_id is not null;

create index if not exists prompt_configs_updated_by_idx
  on public.prompt_configs (updated_by)
  where updated_by is not null;

create index if not exists role_permissions_permission_id_idx
  on public.role_permissions (permission_id);

create index if not exists show_timeline_items_catalogue_item_id_idx
  on public.show_timeline_items (catalogue_item_id)
  where catalogue_item_id is not null;

create index if not exists supplier_inventory_items_updated_by_idx
  on public.supplier_inventory_items (updated_by)
  where updated_by is not null;

create index if not exists user_permission_overrides_assigned_by_idx
  on public.user_permission_overrides (assigned_by)
  where assigned_by is not null;

create index if not exists user_permission_overrides_permission_id_idx
  on public.user_permission_overrides (permission_id);

create index if not exists user_roles_assigned_by_idx
  on public.user_roles (assigned_by)
  where assigned_by is not null;

create index if not exists user_roles_role_id_idx
  on public.user_roles (role_id);

-- These non-unique indexes duplicate existing unique indexes with the exact
-- same leading columns.
drop index if exists public.multishot_fireworks_multishot_id_idx;
drop index if exists public.user_roles_user_id_idx;

-- Policies retained their pre-rename firework_variants names and duplicate the
-- canonical policies created by the hardening migration.
drop policy if exists firework_variants_select_authenticated on public.fireworks;
drop policy if exists firework_variants_admin_modify on public.fireworks;

-- Existing curated presets remain published, but every new row must opt in to
-- public visibility explicitly.
alter table public.show_presets
  alter column is_published set default false;

-- Fail with a useful message before adding constraints. This migration does not
-- repair data because repair policy belongs in a separate reviewed checkpoint.
do $$
begin
  if exists (
    select 1 from public.show_presets
    where duration_seconds is not null and duration_seconds <= 0
  ) then
    raise exception 'show_presets contains non-positive duration_seconds values.'
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from public.show_presets
    where budget_cents is not null and budget_cents < 0
  ) then
    raise exception 'show_presets contains negative budget_cents values.'
      using errcode = 'check_violation';
  end if;

  if exists (select 1 from public.show_presets where total_cents < 0) then
    raise exception 'show_presets contains negative total_cents values.'
      using errcode = 'check_violation';
  end if;

  if exists (select 1 from public.show_presets where effects_count < 0) then
    raise exception 'show_presets contains negative effects_count values.'
      using errcode = 'check_violation';
  end if;

  if exists (select 1 from public.show_presets where sort_order < 0) then
    raise exception 'show_presets contains negative sort_order values.'
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from public.show_presets
    where jsonb_typeof(preview_cues) is distinct from 'array'
  ) then
    raise exception 'show_presets.preview_cues must contain JSON arrays.'
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from public.shows
    where (duration_seconds is not null and duration_seconds <= 0)
      or (budget_cents is not null and budget_cents < 0)
      or total_cents < 0
      or effects_count < 0
      or (safety_meters is not null and safety_meters < 0)
      or (sync_percent is not null and sync_percent not between 0 and 100)
  ) then
    raise exception 'shows contains invalid duration, cost, safety, effect or sync values.'
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from public.show_timeline_items
    where position <= 0
      or time_seconds is null
      or time_seconds < 0
  ) then
    raise exception 'show_timeline_items contains invalid positions or times.'
      using errcode = 'check_violation';
  end if;

  if exists (
    select show_id, position
    from public.show_timeline_items
    group by show_id, position
    having count(*) > 1
  ) then
    raise exception 'show_timeline_items contains duplicate positions within a show.'
      using errcode = 'unique_violation';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.show_presets'::regclass
      and conname = 'show_presets_duration_positive'
  ) then
    alter table public.show_presets
      add constraint show_presets_duration_positive
      check (duration_seconds is null or duration_seconds > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.show_presets'::regclass
      and conname = 'show_presets_budget_nonnegative'
  ) then
    alter table public.show_presets
      add constraint show_presets_budget_nonnegative
      check (budget_cents is null or budget_cents >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.show_presets'::regclass
      and conname = 'show_presets_total_nonnegative'
  ) then
    alter table public.show_presets
      add constraint show_presets_total_nonnegative
      check (total_cents >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.show_presets'::regclass
      and conname = 'show_presets_effects_nonnegative'
  ) then
    alter table public.show_presets
      add constraint show_presets_effects_nonnegative
      check (effects_count >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.show_presets'::regclass
      and conname = 'show_presets_sort_order_nonnegative'
  ) then
    alter table public.show_presets
      add constraint show_presets_sort_order_nonnegative
      check (sort_order >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.show_presets'::regclass
      and conname = 'show_presets_preview_cues_array'
  ) then
    alter table public.show_presets
      add constraint show_presets_preview_cues_array
      check (jsonb_typeof(preview_cues) = 'array');
  end if;
end;
$$;

-- Shows and timeline items now have one explicit representation for every
-- value the application requires. Existing linked data passes the preflight
-- above, so these constraints do not need a repair step.
alter table public.show_timeline_items
  alter column position drop default,
  alter column time_seconds set not null;

create unique index if not exists show_timeline_items_show_id_position_key
  on public.show_timeline_items (show_id, position);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.show_timeline_items'::regclass
      and conname = 'show_timeline_items_show_id_position_key'
  ) then
    alter table public.show_timeline_items
      add constraint show_timeline_items_show_id_position_key
      unique using index show_timeline_items_show_id_position_key;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.show_timeline_items'::regclass
      and conname = 'show_timeline_items_position_positive'
  ) then
    alter table public.show_timeline_items
      add constraint show_timeline_items_position_positive
      check (position > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.show_timeline_items'::regclass
      and conname = 'show_timeline_items_time_nonnegative'
  ) then
    alter table public.show_timeline_items
      add constraint show_timeline_items_time_nonnegative
      check (time_seconds >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.shows'::regclass
      and conname = 'shows_duration_positive'
  ) then
    alter table public.shows
      add constraint shows_duration_positive
      check (duration_seconds is null or duration_seconds > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.shows'::regclass
      and conname = 'shows_budget_nonnegative'
  ) then
    alter table public.shows
      add constraint shows_budget_nonnegative
      check (budget_cents is null or budget_cents >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.shows'::regclass
      and conname = 'shows_total_nonnegative'
  ) then
    alter table public.shows
      add constraint shows_total_nonnegative
      check (total_cents >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.shows'::regclass
      and conname = 'shows_effects_nonnegative'
  ) then
    alter table public.shows
      add constraint shows_effects_nonnegative
      check (effects_count >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.shows'::regclass
      and conname = 'shows_safety_nonnegative'
  ) then
    alter table public.shows
      add constraint shows_safety_nonnegative
      check (safety_meters is null or safety_meters >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.shows'::regclass
      and conname = 'shows_sync_percent_range'
  ) then
    alter table public.shows
      add constraint shows_sync_percent_range
      check (sync_percent is null or sync_percent between 0 and 100);
  end if;
end;
$$;

-- The new unique constraint covers the old non-unique access path exactly.
drop index if exists public.show_cues_show_id_idx;
