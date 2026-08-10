-- The existing timeline-safety trigger validates the full catalogue after
-- this update and legitimately exceeds the project's normal statement limit.
set statement_timeout = '10min';

-- Timeline tracks are editor-only metadata. Avoid cascading derived-state
-- recomputation when this is the sole changed field, while retaining the full
-- trigger path whenever any physical shot data changes at the same time.
create or replace function private.sync_multishot_derived_state_from_shot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and (pg_catalog.to_jsonb(old) - 'timeline_track_index')
      is not distinct from
      (pg_catalog.to_jsonb(new) - 'timeline_track_index')
  then
    return new;
  end if;

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

-- Spread only untouched legacy sequences across the four tracks shown by
-- default. Ordering by the UUID hash makes the layout varied but repeatable,
-- while row_number keeps the distribution balanced within each multishot.
with legacy_multishots as (
  select multishot_id
  from public.multishot_fireworks
  group by multishot_id
  having bool_and(timeline_track_index = 0)
),
ranked_shots as (
  select
    shot.id,
    (
      (
        row_number() over (
          partition by shot.multishot_id
          order by md5(shot.id::text)
        ) - 1
      ) % 4
    )::integer as timeline_track_index
  from public.multishot_fireworks as shot
  inner join legacy_multishots as legacy
    on legacy.multishot_id = shot.multishot_id
)
update public.multishot_fireworks as shot
set timeline_track_index = ranked.timeline_track_index
from ranked_shots as ranked
where shot.id = ranked.id
  and shot.timeline_track_index is distinct from ranked.timeline_track_index;

reset statement_timeout;
