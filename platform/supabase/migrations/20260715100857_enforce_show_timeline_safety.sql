-- Timeline safety must survive direct RPC calls and concurrent requests. Cue
-- intervals are half-open, so a launch position becomes available exactly
-- when the previous catalogue item's conservative duration ends.

do $$
declare
  conflict record;
begin
  select
    first_item.show_id,
    first_item.id as first_cue_id,
    second_item.id as second_cue_id,
    first_item.launch_position_index
  into conflict
  from public.show_timeline_items first_item
  join public.show_timeline_items second_item
    on second_item.show_id = first_item.show_id
   and second_item.position > first_item.position
   and second_item.launch_position_index = first_item.launch_position_index
  where first_item.time_seconds
          < second_item.time_seconds
            + coalesce(
                private.catalogue_item_safe_duration(second_item.catalogue_item_id),
                0.5
              )
    and second_item.time_seconds
          < first_item.time_seconds
            + coalesce(
                private.catalogue_item_safe_duration(first_item.catalogue_item_id),
                0.5
              )
  limit 1;

  if found then
    raise exception
      'Show % has overlapping timeline cues % and % on launch position %.',
      conflict.show_id,
      conflict.first_cue_id,
      conflict.second_cue_id,
      conflict.launch_position_index
      using errcode = '23514';
  end if;
end;
$$;

create or replace function private.reject_overlapping_show_timeline_item()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  candidate_duration numeric;
begin
  -- Serialise every supported mutation path on the owned show before the
  -- overlap read. The public RPCs also acquire this lock before their DML so
  -- the insert statement starts with the latest committed schedule.
  perform 1
  from public.shows show_row
  where show_row.id = new.show_id
  for update;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Show was not found.';
  end if;

  candidate_duration :=
    private.catalogue_item_safe_duration(new.catalogue_item_id);

  if candidate_duration is null then
    raise exception using
      errcode = '23503',
      message = 'Catalogue item was not found.';
  end if;

  if exists (
    select 1
    from public.show_timeline_items existing_item
    where existing_item.show_id = new.show_id
      and existing_item.id <> new.id
      and existing_item.launch_position_index = new.launch_position_index
      and new.time_seconds
            < existing_item.time_seconds
              + coalesce(
                  private.catalogue_item_safe_duration(existing_item.catalogue_item_id),
                  0.5
                )
      and existing_item.time_seconds
            < new.time_seconds + candidate_duration
  ) then
    raise exception using
      errcode = '23514',
      message = format(
        'Timeline item overlaps launch position %s.',
        new.launch_position_index
      );
  end if;

  return new;
end;
$$;

revoke execute on function private.reject_overlapping_show_timeline_item()
  from public, anon, authenticated, service_role;

drop trigger if exists show_timeline_items_reject_overlap
  on public.show_timeline_items;

create trigger show_timeline_items_reject_overlap
before insert or update of
  show_id,
  time_seconds,
  catalogue_item_id,
  launch_position_index
on public.show_timeline_items
for each row
execute function private.reject_overlapping_show_timeline_item();

create or replace function public.replace_show_timeline_items(
  p_show_id uuid,
  p_user_id uuid,
  p_items jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  replaced_count integer := 0;
begin
  if actor_id is null
    or p_user_id is distinct from actor_id
    or not coalesce(public.current_user_is_active(), false)
  then
    raise exception using
      errcode = '42501',
      message = 'Not permitted.';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception using
      errcode = '22023',
      message = 'Timeline replacement payload must be a JSON array.';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception using
      errcode = '22023',
      message = 'Timeline replacement payload must contain at least one cue.';
  end if;

  perform 1
  from public.shows show_row
  where show_row.id = p_show_id
    and show_row.user_id = actor_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Show was not found.';
  end if;

  delete from public.show_timeline_items timeline_item
  where timeline_item.show_id = p_show_id;

  insert into public.show_timeline_items (
    show_id,
    position,
    time_seconds,
    description,
    catalogue_item_id,
    launch_position_index,
    emphasis
  )
  select
    p_show_id,
    cue.position,
    cue.time_seconds,
    cue.description,
    cue.catalogue_item_id,
    cue.launch_position_index,
    cue.emphasis
  from jsonb_to_recordset(p_items) as cue(
    position integer,
    time_seconds numeric,
    description text,
    catalogue_item_id uuid,
    launch_position_index integer,
    emphasis text
  )
  order by cue.position;

  get diagnostics replaced_count = row_count;
  return replaced_count;
end;
$$;

create or replace function public.add_show_timeline_item(
  p_show_id uuid,
  p_time_seconds numeric,
  p_catalogue_item_id uuid,
  p_launch_position_index integer,
  p_emphasis text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  cue_id uuid;
  cue_description text;
  next_position integer;
begin
  if actor_id is null
    or not coalesce(public.current_user_is_active(), false)
  then
    raise exception using
      errcode = '42501',
      message = 'Not permitted.';
  end if;

  if p_show_id is null
    or p_time_seconds is null
    or p_time_seconds < 0
    or p_time_seconds > 3600
    or p_catalogue_item_id is null
    or p_launch_position_index is null
    or p_launch_position_index not between 0 and 2
    or p_emphasis is null
    or p_emphasis not in ('normal', 'accent', 'peak')
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid timeline item.';
  end if;

  perform 1
  from public.shows show_row
  where show_row.id = p_show_id
    and show_row.user_id = actor_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Show was not found.';
  end if;

  select coalesce(max(timeline_item.position), 0) + 1
  into next_position
  from public.show_timeline_items timeline_item
  where timeline_item.show_id = p_show_id;

  select catalogue.name
  into cue_description
  from public.catalogue_items catalogue
  where catalogue.id = p_catalogue_item_id;

  if not found or nullif(btrim(cue_description), '') is null then
    raise exception using
      errcode = 'P0002',
      message = 'Firework was not found.';
  end if;

  insert into public.show_timeline_items (
    show_id,
    position,
    time_seconds,
    description,
    catalogue_item_id,
    launch_position_index,
    emphasis
  )
  values (
    p_show_id,
    next_position,
    round(p_time_seconds, 2),
    btrim(cue_description),
    p_catalogue_item_id,
    p_launch_position_index,
    p_emphasis
  )
  returning id into cue_id;

  return cue_id;
end;
$$;

create or replace function public.delete_show_timeline_item(
  p_cue_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_show_id uuid;
begin
  if actor_id is null
    or not coalesce(public.current_user_is_active(), false)
  then
    raise exception using
      errcode = '42501',
      message = 'Not permitted.';
  end if;

  if p_cue_id is null then
    raise exception using
      errcode = '22023',
      message = 'Invalid timeline item.';
  end if;

  select timeline_item.show_id
  into target_show_id
  from public.show_timeline_items timeline_item
  join public.shows show_row
    on show_row.id = timeline_item.show_id
  where timeline_item.id = p_cue_id
    and show_row.user_id = actor_id
  for update of show_row;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Timeline item was not found.';
  end if;

  delete from public.show_timeline_items timeline_item
  where timeline_item.id = p_cue_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Timeline item was not found.';
  end if;

  return target_show_id;
end;
$$;

-- Preserve the paid refinement transaction while adding the same show lock
-- and overlap trigger used by ordinary cue additions.
create or replace function public.add_refinement_cue_and_settle_credits(
  p_refinement_id uuid,
  p_show_id uuid,
  p_position integer,
  p_time_seconds numeric,
  p_catalogue_item_id uuid,
  p_launch_position_index integer,
  p_emphasis text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  reservation_key text;
  reservation_status text;
  cue_description text;
  cue_time_seconds numeric(8, 2);
  existing_cue public.show_timeline_items%rowtype;
  next_position integer;
  settlement jsonb;
begin
  if actor_id is null
    or not coalesce(public.current_user_is_active(), false)
  then
    raise exception using
      errcode = '42501',
      message = 'Not permitted.';
  end if;

  if p_refinement_id is null
    or p_show_id is null
    or p_catalogue_item_id is null
    or p_position is null
    or p_position <= 0
    or p_time_seconds is null
    or p_time_seconds < 0
    or p_time_seconds > 3600
    or p_launch_position_index is null
    or p_launch_position_index not between 0 and 2
    or p_emphasis is null
    or p_emphasis not in ('normal', 'accent', 'peak')
    or p_metadata is null
    or jsonb_typeof(p_metadata) <> 'object'
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid refinement cue.';
  end if;

  perform 1
  from public.shows show_row
  where show_row.id = p_show_id
    and show_row.user_id = actor_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Show was not found.';
  end if;

  -- Keep p_position in the public signature for existing callers, but allocate
  -- from the locked schedule so concurrent valid additions cannot collide.
  select coalesce(max(timeline_item.position), 0) + 1
  into next_position
  from public.show_timeline_items timeline_item
  where timeline_item.show_id = p_show_id;

  select catalogue.name
  into cue_description
  from public.catalogue_items catalogue
  where catalogue.id = p_catalogue_item_id;

  if not found or nullif(btrim(cue_description), '') is null then
    raise exception using
      errcode = 'P0002',
      message = 'Firework was not found.';
  end if;

  reservation_key := 'show-refinement:' || p_refinement_id::text || ':reserve';
  perform pg_advisory_xact_lock(hashtextextended(reservation_key, 0));

  select credit_transaction.status
  into reservation_status
  from public.ai_credit_transactions credit_transaction
  where credit_transaction.user_id = actor_id
    and credit_transaction.idempotency_key = reservation_key
    and credit_transaction.transaction_type = 'reserve'
    and credit_transaction.action_key = 'show_refinement'
    and credit_transaction.reference_type = 'show_refinements'
    and credit_transaction.reference_id = p_refinement_id;

  if not found or reservation_status not in ('reserved', 'settled') then
    raise exception using
      errcode = 'P0002',
      message = 'AI credit reservation was not found.';
  end if;

  cue_time_seconds := round(p_time_seconds, 2);
  select *
  into existing_cue
  from public.show_timeline_items timeline_item
  where timeline_item.id = p_refinement_id;

  if found then
    if existing_cue.show_id <> p_show_id
      or existing_cue.catalogue_item_id <> p_catalogue_item_id
      or existing_cue.time_seconds <> cue_time_seconds
      or existing_cue.launch_position_index <> p_launch_position_index
      or existing_cue.emphasis <> p_emphasis
    then
      raise exception using
        errcode = '23505',
        message = 'This refinement identifier is already in use.';
    end if;
  else
    insert into public.show_timeline_items (
      id,
      show_id,
      position,
      time_seconds,
      description,
      catalogue_item_id,
      launch_position_index,
      emphasis
    )
    values (
      p_refinement_id,
      p_show_id,
      next_position,
      cue_time_seconds,
      btrim(cue_description),
      p_catalogue_item_id,
      p_launch_position_index,
      p_emphasis
    );
  end if;

  settlement := public.settle_ai_credit_reservation(
    actor_id,
    reservation_key,
    reservation_key || ':debit',
    p_metadata
  );

  if not coalesce((settlement ->> 'ok')::boolean, false) then
    raise exception using
      errcode = 'P0001',
      message = 'AI credit reservation could not be settled.';
  end if;

  return p_refinement_id;
end;
$$;

-- Timeline writes are available only through the guarded RPCs above. Reads
-- retain their existing owner policy and Data API grant.
revoke all privileges on table public.show_timeline_items
  from authenticated;
grant select on table public.show_timeline_items
  to authenticated;

drop policy if exists show_timeline_items_insert_via_show
  on public.show_timeline_items;
drop policy if exists show_timeline_items_update_via_show
  on public.show_timeline_items;
drop policy if exists show_timeline_items_delete_via_show
  on public.show_timeline_items;

revoke execute on function public.replace_show_timeline_items(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke execute on function public.add_show_timeline_item(
  uuid,
  numeric,
  uuid,
  integer,
  text
) from public, anon, authenticated, service_role;
revoke execute on function public.delete_show_timeline_item(uuid)
  from public, anon, authenticated, service_role;
revoke execute on function public.add_refinement_cue_and_settle_credits(
  uuid,
  uuid,
  integer,
  numeric,
  uuid,
  integer,
  text,
  jsonb
) from public, anon, authenticated, service_role;

grant execute on function public.replace_show_timeline_items(uuid, uuid, jsonb)
  to authenticated;
grant execute on function public.add_show_timeline_item(
  uuid,
  numeric,
  uuid,
  integer,
  text
) to authenticated;
grant execute on function public.delete_show_timeline_item(uuid)
  to authenticated;
grant execute on function public.add_refinement_cue_and_settle_credits(
  uuid,
  uuid,
  integer,
  numeric,
  uuid,
  integer,
  text,
  jsonb
) to authenticated;
