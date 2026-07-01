-- Remove the legacy base-effect classification column. Older local branches
-- called it `family`; a later draft called it `type`. The app now treats the
-- renderer pattern/model as the source of truth instead.

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'firework_effects_family_check'
      and conrelid = 'public.firework_effects'::regclass
  ) then
    alter table public.firework_effects
      drop constraint firework_effects_family_check;
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'firework_effects_type_check'
      and conrelid = 'public.firework_effects'::regclass
  ) then
    alter table public.firework_effects
      drop constraint firework_effects_type_check;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'firework_effects'
      and column_name = 'type'
  ) then
    alter table public.firework_effects drop column type;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'firework_effects'
      and column_name = 'family'
  ) then
    alter table public.firework_effects drop column family;
  end if;
end $$;

do $$
begin
  if to_regclass('public.firework_editor_versions') is null then
    return;
  end if;

  update public.firework_editor_versions
  set
    snapshot_json = snapshot_json - 'family' - 'type',
    previous_snapshot_json = previous_snapshot_json - 'family' - 'type',
    changes_json = changes_json - 'family' - 'type'
  where target_kind = 'effect'
    and (
      snapshot_json ? 'family'
      or snapshot_json ? 'type'
      or coalesce(previous_snapshot_json, '{}'::jsonb) ? 'family'
      or coalesce(previous_snapshot_json, '{}'::jsonb) ? 'type'
      or changes_json ? 'family'
      or changes_json ? 'type'
    );
end $$;
