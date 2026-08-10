-- Pack the currently imported multishot sequences into as many editor tracks
-- as their visual clip durations require. This is intentionally a one-off
-- backfill: future shots retain the explicit track chosen by the editor.
create temporary table multishot_track_assignments (
  id uuid primary key,
  timeline_track_index integer not null
) on commit drop;

do $$
declare
  current_multishot_id uuid;
  track_ends numeric[] := array[]::numeric[];
  track_position integer;
  selected_track integer;
  shot_end numeric;
  shot record;
begin
  for shot in
    select
      multishot_shot.id,
      multishot_shot.multishot_id,
      multishot_shot.sequence_index,
      multishot_shot.time_offset_seconds,
      greatest(
        case
          when firework.duration_seconds > 0 then firework.duration_seconds
          else 2.4
        end,
        46.0 / 96.0
      ) as clip_duration
    from public.multishot_fireworks as multishot_shot
    inner join public.fireworks as firework
      on firework.id = multishot_shot.firework_id
    order by
      multishot_shot.multishot_id,
      multishot_shot.time_offset_seconds,
      multishot_shot.sequence_index,
      multishot_shot.id
  loop
    if current_multishot_id is distinct from shot.multishot_id then
      current_multishot_id := shot.multishot_id;
      track_ends := array[]::numeric[];
    end if;

    selected_track := null;
    if coalesce(array_length(track_ends, 1), 0) > 0 then
      for track_position in 1..array_length(track_ends, 1) loop
        if shot.time_offset_seconds >= track_ends[track_position] then
          selected_track := track_position;
          exit;
        end if;
      end loop;
    end if;

    shot_end := shot.time_offset_seconds + shot.clip_duration;
    if selected_track is null then
      track_ends := array_append(track_ends, shot_end);
      selected_track := array_length(track_ends, 1);
    else
      track_ends[selected_track] := shot_end;
    end if;

    insert into multishot_track_assignments (id, timeline_track_index)
    values (shot.id, selected_track - 1);
  end loop;
end;
$$;

update public.multishot_fireworks as shot
set timeline_track_index = assignment.timeline_track_index
from multishot_track_assignments as assignment
where shot.id = assignment.id
  and shot.timeline_track_index is distinct from assignment.timeline_track_index;
