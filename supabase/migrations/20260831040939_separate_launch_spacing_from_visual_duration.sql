-- A launch position represents a spatial firing lane containing independently
-- wired products. It must prevent effectively simultaneous ignitions, but a
-- previous firework's visual tail does not make the whole lane unavailable.

begin;

lock table public.show_timeline_items in share row exclusive mode;

create or replace function private.show_launch_interval_seconds()
returns numeric
language sql
immutable
security invoker
set search_path = ''
as $$
  select 0.5::numeric;
$$;

revoke execute on function private.show_launch_interval_seconds()
  from public, anon, authenticated, service_role;

create or replace function private.assert_show_timeline_non_overlapping(
  p_show_ids uuid[] default null::uuid[]
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  conflict record;
begin
  -- Preserve the deployed scoped-preflight contract. An explicit empty set
  -- means the caller has proved that no current show needs revalidation.
  if p_show_ids is not null and coalesce(array_length(p_show_ids, 1), 0) = 0 then
    return;
  end if;

  select
    first_item.show_id,
    first_item.id as first_cue_id,
    second_item.id as second_cue_id,
    first_occupancy.positions as first_positions,
    second_occupancy.positions as second_positions
  into conflict
  from public.show_timeline_items first_item
  join public.show_timeline_items second_item
    on second_item.show_id = first_item.show_id
   and second_item.position > first_item.position
  cross join lateral (
    select private.catalogue_item_occupied_launch_positions(
      first_item.catalogue_item_id,
      first_item.launch_position_index
    ) as positions
  ) first_occupancy
  cross join lateral (
    select private.catalogue_item_occupied_launch_positions(
      second_item.catalogue_item_id,
      second_item.launch_position_index
    ) as positions
  ) second_occupancy
  where (p_show_ids is null or first_item.show_id = any(p_show_ids))
    and first_occupancy.positions && second_occupancy.positions
    and first_item.time_seconds
          < second_item.time_seconds + private.show_launch_interval_seconds()
    and second_item.time_seconds
          < first_item.time_seconds + private.show_launch_interval_seconds()
  limit 1;

  if found then
    raise exception
      'Show % has ignitions closer than 0.5 seconds for cues % and % on launch positions % and %.',
      conflict.show_id,
      conflict.first_cue_id,
      conflict.second_cue_id,
      conflict.first_positions,
      conflict.second_positions
      using errcode = '23514';
  end if;
end;
$$;

revoke execute on function private.assert_show_timeline_non_overlapping(uuid[])
  from public, anon, authenticated, service_role;

select private.assert_show_timeline_non_overlapping(null::uuid[]);

create or replace function private.reject_overlapping_show_timeline_item()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  candidate_occupied_positions integer[];
begin
  -- Serialise every supported mutation path on the owned show before reading
  -- its current schedule. Public mutation RPCs take the same row lock.
  perform 1
  from public.shows show_row
  where show_row.id = new.show_id
  for update;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Show was not found.';
  end if;

  perform 1
  from public.catalogue_items item
  where item.id = new.catalogue_item_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Catalogue item was not found.';
  end if;

  candidate_occupied_positions :=
    private.catalogue_item_occupied_launch_positions(
      new.catalogue_item_id,
      new.launch_position_index
    );

  if exists (
    select 1
    from public.show_timeline_items existing_item
    where existing_item.show_id = new.show_id
      and existing_item.id <> new.id
      and private.catalogue_item_occupied_launch_positions(
            existing_item.catalogue_item_id,
            existing_item.launch_position_index
          ) && candidate_occupied_positions
      and new.time_seconds
            < existing_item.time_seconds + private.show_launch_interval_seconds()
      and existing_item.time_seconds
            < new.time_seconds + private.show_launch_interval_seconds()
  ) then
    raise exception using
      errcode = '23514',
      message = 'Timeline item is too close to another ignition on this launch position.';
  end if;

  return new;
end;
$$;

revoke execute on function private.reject_overlapping_show_timeline_item()
  from public, anon, authenticated, service_role;

comment on function private.show_launch_interval_seconds() is
  'Minimum separation between independently wired ignitions at an occupied launch position. Visual duration is intentionally separate.';

commit;
