create or replace function public.replace_show_timeline_items(
  p_show_id uuid,
  p_user_id uuid,
  p_items jsonb
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  replaced_count integer := 0;
begin
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Timeline replacement payload must be a JSON array.';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'Timeline replacement payload must contain at least one cue.';
  end if;

  if not exists (
    select 1
    from public.shows
    where id = p_show_id
      and user_id = p_user_id
  ) then
    raise exception 'Show was not found for this user.';
  end if;

  delete from public.show_timeline_items
  where show_id = p_show_id;

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

grant execute on function public.replace_show_timeline_items(uuid, uuid, jsonb) to authenticated;
