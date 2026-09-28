-- Background generation can write normal shows only through the active lease.
CREATE OR REPLACE FUNCTION "public"."replace_generated_show_timeline_items"("p_show_id" "uuid", "p_user_id" "uuid", "p_items" "jsonb", "p_lease_token" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  actor_id uuid := auth.uid();
  actor_role text := auth.role();
  target_show public.shows;
  replaced_count integer := 0;
begin
  if actor_role is distinct from 'service_role' and (
    actor_id is null
    or p_user_id is distinct from actor_id
    or not coalesce(public.current_user_is_active(), false)
  ) then
    raise exception 'Not permitted.' using errcode = '42501';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array'
    or jsonb_array_length(p_items) = 0
  then
    raise exception 'Timeline replacement payload must contain at least one cue.'
      using errcode = '22023';
  end if;

  select * into target_show
  from public.shows show_row
  where show_row.id = p_show_id
    and show_row.user_id = p_user_id
  for update;
  if not found then
    raise exception 'Show was not found.' using errcode = 'P0002';
  end if;

  if target_show.generation_status <> 'running'
    or p_lease_token is null
    or target_show.generation_lease_token is distinct from p_lease_token
    or target_show.generation_lease_expires_at is null
    or target_show.generation_lease_expires_at <= now()
  then
    raise exception 'Cue generation lease is no longer active.' using errcode = '55000';
  end if;

  if target_show.creation_source = 'assortment_qr' and (
    not exists (
      select 1 from public.show_assortment_items snapshot
      where snapshot.show_id = target_show.id
    )
    or exists (
      select 1
      from jsonb_to_recordset(p_items) as cue(catalogue_item_id uuid)
      left join public.show_assortment_items snapshot
        on snapshot.show_id = target_show.id
        and snapshot.catalogue_item_id = cue.catalogue_item_id
      where cue.catalogue_item_id is null
        or snapshot.catalogue_item_id is null
    )
    or exists (
      select 1
      from public.show_assortment_items snapshot
      where snapshot.show_id = target_show.id
        and (
          select count(*)
          from jsonb_to_recordset(p_items) as cue(catalogue_item_id uuid)
          where cue.catalogue_item_id = snapshot.catalogue_item_id
        ) <> snapshot.quantity
    )
  ) then
    raise exception 'Generated cues must consume every assortment product exactly once per purchased unit.'
      using errcode = '23514';
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

ALTER FUNCTION "public"."replace_generated_show_timeline_items"("p_show_id" "uuid", "p_user_id" "uuid", "p_items" "jsonb", "p_lease_token" "uuid") OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.replace_generated_show_timeline_items(uuid, uuid, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_generated_show_timeline_items(uuid, uuid, jsonb, uuid) TO authenticated, service_role;
