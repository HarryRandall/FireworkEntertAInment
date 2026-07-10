-- Align database constraints with the shared admin multishot contract. One
-- legacy imported shot predates the editor bounds; clamp it to the nearest
-- supported aim before adding the checks.
update public.multishot_fireworks
set pan_degrees = greatest(-30, least(30, pan_degrees)),
    tilt_degrees = greatest(-50, least(50, tilt_degrees))
where pan_degrees not between -30 and 30
   or tilt_degrees not between -50 and 50;

do $$
begin
  if exists (
    select 1
    from public.multishots
    where char_length(btrim(name)) not between 1 and 180
      or char_length(coalesce(description, '')) > 5000
      or (duration_seconds is not null and duration_seconds not between 0 and 3600)
      or shot_count not between 0 and 2000
  ) then
    raise exception 'multishots contains values outside the supported admin bounds.'
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1
    from public.multishot_fireworks
    where sequence_index not between 1 and 2000
      or time_offset_seconds not between 0 and 3600
      or pan_degrees not between -30 and 30
      or tilt_degrees not between -50 and 50
      or char_length(coalesce(caliber, '')) > 40
      or char_length(coalesce(notes, '')) > 500
  ) then
    raise exception 'multishot_fireworks contains values outside the supported admin bounds.'
      using errcode = 'check_violation';
  end if;

  if exists (
    select multishot_id
    from public.catalogue_items
    where multishot_id is not null
    group by multishot_id
    having count(*) > 1
  ) then
    raise exception 'A multishot is linked to more than one catalogue item.'
      using errcode = 'unique_violation';
  end if;
end;
$$;

alter table public.multishot_fireworks
  drop constraint if exists multishot_fireworks_tilt_degrees_check;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.multishots'::regclass
      and conname = 'multishots_name_length'
  ) then
    alter table public.multishots
      add constraint multishots_name_length
      check (char_length(btrim(name)) between 1 and 180);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.multishots'::regclass
      and conname = 'multishots_description_length'
  ) then
    alter table public.multishots
      add constraint multishots_description_length
      check (char_length(coalesce(description, '')) <= 5000);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.multishots'::regclass
      and conname = 'multishots_duration_range'
  ) then
    alter table public.multishots
      add constraint multishots_duration_range
      check (duration_seconds is null or duration_seconds between 0 and 3600);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.multishots'::regclass
      and conname = 'multishots_shot_count_range'
  ) then
    alter table public.multishots
      add constraint multishots_shot_count_range
      check (shot_count between 0 and 2000);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.multishot_fireworks'::regclass
      and conname = 'multishot_fireworks_sequence_range'
  ) then
    alter table public.multishot_fireworks
      add constraint multishot_fireworks_sequence_range
      check (sequence_index between 1 and 2000);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.multishot_fireworks'::regclass
      and conname = 'multishot_fireworks_time_range'
  ) then
    alter table public.multishot_fireworks
      add constraint multishot_fireworks_time_range
      check (time_offset_seconds between 0 and 3600);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.multishot_fireworks'::regclass
      and conname = 'multishot_fireworks_pan_range'
  ) then
    alter table public.multishot_fireworks
      add constraint multishot_fireworks_pan_range
      check (pan_degrees between -30 and 30);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.multishot_fireworks'::regclass
      and conname = 'multishot_fireworks_tilt_range'
  ) then
    alter table public.multishot_fireworks
      add constraint multishot_fireworks_tilt_range
      check (tilt_degrees between -50 and 50);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.multishot_fireworks'::regclass
      and conname = 'multishot_fireworks_caliber_length'
  ) then
    alter table public.multishot_fireworks
      add constraint multishot_fireworks_caliber_length
      check (char_length(coalesce(caliber, '')) <= 40);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.multishot_fireworks'::regclass
      and conname = 'multishot_fireworks_notes_length'
  ) then
    alter table public.multishot_fireworks
      add constraint multishot_fireworks_notes_length
      check (char_length(coalesce(notes, '')) <= 500);
  end if;
end;
$$;

drop index if exists public.catalogue_items_multishot_id_idx;
drop index if exists public.catalogue_items_multishot_id_key;
alter table public.catalogue_items
  add constraint catalogue_items_multishot_id_key unique (multishot_id);

-- Calculate the shortest safe multishot duration from its final child shot.
-- Use the longest linked catalogue or firework duration, and retain the same
-- 0.5 second conservative fallback used by cue overlap validation.
create or replace function private.multishot_minimum_duration(p_multishot_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    ceil(
      max(
        shot.time_offset_seconds
        + greatest(
          coalesce(
            (
              select max(item.duration_seconds)
              from public.catalogue_items item
              where item.firework_id = shot.firework_id
                and item.duration_seconds is not null
            ),
            0::numeric
          ),
          coalesce(firework.duration_seconds, 0::numeric),
          0.5::numeric
        )
      ) * 100
    ) / 100,
    0::numeric
  )
  from public.multishot_fireworks shot
  left join public.fireworks firework on firework.id = shot.firework_id
  where shot.multishot_id = p_multishot_id;
$$;

revoke execute on function private.multishot_minimum_duration(uuid)
  from public, anon, authenticated, service_role;

do $$
begin
  if exists (
    select 1
    from public.multishots multishot
    where private.multishot_minimum_duration(multishot.id) > 3600
  ) then
    raise exception 'A multishot requires more than the supported 3600 second duration.'
      using errcode = 'check_violation';
  end if;
end;
$$;

-- Direct metadata writes cannot make a multishot shorter than its final child.
-- Clearing the duration derives the minimum instead.
create or replace function private.enforce_multishot_minimum_duration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  minimum_duration numeric := private.multishot_minimum_duration(new.id);
begin
  if minimum_duration > 0 and new.duration_seconds is null then
    new.duration_seconds := minimum_duration;
  elsif new.duration_seconds is not null and new.duration_seconds < minimum_duration then
    raise exception 'Multishot duration must be at least % seconds.', minimum_duration
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke execute on function private.enforce_multishot_minimum_duration()
  from public, anon, authenticated, service_role;

drop trigger if exists multishots_enforce_minimum_duration on public.multishots;
create trigger multishots_enforce_minimum_duration
  before update of duration_seconds on public.multishots
  for each row execute function private.enforce_multishot_minimum_duration();

-- Lock the parent and recompute both derived fields together. The duration only
-- rises automatically, so an explicit longer duration is never reduced.
create or replace function private.sync_multishot_derived_state(p_multishot_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  derived_shot_count integer;
  minimum_duration numeric;
  next_duration numeric;
begin
  perform 1
  from public.multishots
  where id = p_multishot_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Multishot was not found.');
  end if;

  select count(*)::integer
  into derived_shot_count
  from public.multishot_fireworks
  where multishot_id = p_multishot_id;

  minimum_duration := private.multishot_minimum_duration(p_multishot_id);
  if minimum_duration > 3600 then
    raise exception 'Multishot requires % seconds, above the supported 3600 second duration.',
      minimum_duration
      using errcode = 'check_violation';
  end if;

  update public.multishots
  set shot_count = derived_shot_count,
      duration_seconds = case
        when minimum_duration > 0
          and (duration_seconds is null or duration_seconds < minimum_duration)
          then minimum_duration
        else duration_seconds
      end
  where id = p_multishot_id
  returning duration_seconds into next_duration;

  return jsonb_build_object(
    'ok', true,
    'shotCount', derived_shot_count,
    'minimumDurationSeconds', minimum_duration,
    'durationSeconds', next_duration
  );
end;
$$;

revoke execute on function private.sync_multishot_derived_state(uuid)
  from public, anon, authenticated, service_role;

-- Every shot mutation reaches the same transactional recomputation path.
create or replace function private.sync_multishot_derived_state_from_shot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.sync_multishot_derived_state(old.multishot_id);
    return old;
  end if;

  perform private.sync_multishot_derived_state(new.multishot_id);
  if tg_op = 'UPDATE' and old.multishot_id <> new.multishot_id then
    perform private.sync_multishot_derived_state(old.multishot_id);
  end if;
  return new;
end;
$$;

revoke execute on function private.sync_multishot_derived_state_from_shot()
  from public, anon, authenticated, service_role;

drop trigger if exists multishot_fireworks_sync_derived_state
  on public.multishot_fireworks;
create trigger multishot_fireworks_sync_derived_state
  after insert or update or delete on public.multishot_fireworks
  for each row execute function private.sync_multishot_derived_state_from_shot();

-- A child firework or supplier duration can change after the shot was placed.
-- Propagate those dependency changes through the same locked recomputation so
-- stored multishot and catalogue durations never become shorter than reality.
create or replace function private.sync_multishots_for_firework(p_firework_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_multishot_id uuid;
begin
  if p_firework_id is null then
    return;
  end if;

  for target_multishot_id in
    select distinct shot.multishot_id
    from public.multishot_fireworks shot
    where shot.firework_id = p_firework_id
    order by shot.multishot_id
  loop
    perform private.sync_multishot_derived_state(target_multishot_id);
  end loop;
end;
$$;

revoke execute on function private.sync_multishots_for_firework(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.sync_multishots_from_firework_duration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.sync_multishots_for_firework(new.id);
  return new;
end;
$$;

revoke execute on function private.sync_multishots_from_firework_duration()
  from public, anon, authenticated, service_role;

drop trigger if exists fireworks_sync_multishot_dependencies on public.fireworks;
create trigger fireworks_sync_multishot_dependencies
  after update of duration_seconds on public.fireworks
  for each row execute function private.sync_multishots_from_firework_duration();

create or replace function private.sync_multishots_from_catalogue_duration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.sync_multishots_for_firework(new.firework_id);
  if tg_op = 'UPDATE' and old.firework_id is distinct from new.firework_id then
    perform private.sync_multishots_for_firework(old.firework_id);
  end if;
  return new;
end;
$$;

revoke execute on function private.sync_multishots_from_catalogue_duration()
  from public, anon, authenticated, service_role;

drop trigger if exists catalogue_items_sync_multishot_dependencies_insert
  on public.catalogue_items;
create trigger catalogue_items_sync_multishot_dependencies_insert
  after insert on public.catalogue_items
  for each row execute function private.sync_multishots_from_catalogue_duration();

drop trigger if exists catalogue_items_sync_multishot_dependencies_update
  on public.catalogue_items;
create trigger catalogue_items_sync_multishot_dependencies_update
  after update of duration_seconds, firework_id on public.catalogue_items
  for each row execute function private.sync_multishots_from_catalogue_duration();

-- The action calls the same locked recomputation after a mutation so its result
-- reflects committed state even when multiple admins edit the parent.
create or replace function public.sync_multishot_derived_state(p_multishot_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
    or not public.current_user_has_permission('admin.manage_catalogue') then
    return jsonb_build_object('ok', false, 'error', 'Not permitted.');
  end if;

  return private.sync_multishot_derived_state(p_multishot_id);
end;
$$;

revoke execute on function public.sync_multishot_derived_state(uuid)
  from public, anon;
grant execute on function public.sync_multishot_derived_state(uuid)
  to authenticated, service_role;

-- Backfill derived fields through the same locked function before the new
-- trigger becomes the durable source of truth.
do $$
declare
  target_multishot_id uuid;
begin
  for target_multishot_id in select id from public.multishots order by id loop
    perform private.sync_multishot_derived_state(target_multishot_id);
  end loop;
end;
$$;

-- Auto-create exactly one supplier-facing catalogue row for a new multishot.
-- Later multishot edits must not overwrite supplier-owned SKU, name or copy.
create or replace function public.ensure_catalogue_item_for_multishot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  part_number_value text := coalesce(
    nullif(new.slug, ''),
    'ms-' || left(replace(new.id::text, '-', ''), 8)
  );
begin
  insert into public.catalogue_items (
    part_number,
    name,
    description,
    catalogue_item_kind,
    multishot_id,
    duration_seconds
  )
  values (
    part_number_value,
    new.name,
    new.description,
    'multishot',
    new.id,
    new.duration_seconds
  );

  return new;
end;
$$;

revoke execute on function public.ensure_catalogue_item_for_multishot()
  from public, anon, authenticated;

drop trigger if exists multishots_ensure_catalogue_item on public.multishots;
create trigger multishots_ensure_catalogue_item
  after insert on public.multishots
  for each row execute function public.ensure_catalogue_item_for_multishot();

-- A longer explicit supplier duration stays authoritative. Raising a missing or
-- shorter value keeps overlap validation conservative without touching SKU,
-- name or description.
create or replace function private.raise_catalogue_multishot_duration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.duration_seconds is not null then
    update public.catalogue_items
    set duration_seconds = new.duration_seconds
    where multishot_id = new.id
      and (
        duration_seconds is null
        or duration_seconds < new.duration_seconds
      );
  end if;

  return new;
end;
$$;

revoke execute on function private.raise_catalogue_multishot_duration()
  from public, anon, authenticated, service_role;

drop trigger if exists multishots_raise_catalogue_duration on public.multishots;
create trigger multishots_raise_catalogue_duration
  after update of duration_seconds on public.multishots
  for each row execute function private.raise_catalogue_multishot_duration();

-- Backfill only missing links. Existing supplier metadata is not normalised back
-- to editor values.
insert into public.catalogue_items (
  part_number,
  name,
  description,
  catalogue_item_kind,
  multishot_id,
  duration_seconds
)
select
  coalesce(
    nullif(multishot.slug, ''),
    'ms-' || left(replace(multishot.id::text, '-', ''), 8)
  ),
  multishot.name,
  multishot.description,
  'multishot',
  multishot.id,
  multishot.duration_seconds
from public.multishots multishot
where not exists (
  select 1
  from public.catalogue_items item
  where item.multishot_id = multishot.id
);

update public.catalogue_items item
set duration_seconds = multishot.duration_seconds
from public.multishots multishot
where item.multishot_id = multishot.id
  and multishot.duration_seconds is not null
  and (
    item.duration_seconds is null
    or item.duration_seconds < multishot.duration_seconds
  );
