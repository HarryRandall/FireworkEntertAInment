-- A paid show refinement is one outcome: its cue and credit debit commit
-- together, or neither does. The refinement UUID is also the cue UUID, which
-- makes a retried request idempotent without another public tracking column.

alter function public.reserve_ai_credits(uuid, text, integer, text, uuid, text, jsonb)
  set search_path = '';
alter function public.settle_ai_credit_reservation(uuid, text, text, jsonb)
  set search_path = '';
alter function public.refund_ai_credit_reservation(uuid, text, text, jsonb)
  set search_path = '';

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
  settlement jsonb;
begin
  if actor_id is null
    or not exists (
      select 1
      from public.users actor
      where actor.id = actor_id
        and actor.status = 'active'
    )
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

  if not exists (
    select 1
    from public.shows show_row
    where show_row.id = p_show_id
      and show_row.user_id = actor_id
  ) then
    raise exception using
      errcode = 'P0002',
      message = 'Show was not found.';
  end if;

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
      p_position,
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
