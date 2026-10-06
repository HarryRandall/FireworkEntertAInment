begin;

-- Keep composition revisions distinct even when multiple saves share a transaction.
create or replace trigger multishots_set_updated_at before update on public.multishots
  for each row execute function private.touch_firework_editor_revision();

-- Composition replacement needs one transaction, including its audit snapshots.
create table public.multishot_composition_versions (
  id uuid primary key default gen_random_uuid(),
  multishot_id uuid not null references public.multishots(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  before_shots jsonb not null check (jsonb_typeof(before_shots) = 'array'),
  after_shots jsonb not null check (jsonb_typeof(after_shots) = 'array')
);
create index multishot_composition_versions_recent on public.multishot_composition_versions(multishot_id, created_at desc);
alter table public.multishot_composition_versions enable row level security;
revoke all on public.multishot_composition_versions from public, anon, authenticated;
create policy multishot_composition_versions_admin_read on public.multishot_composition_versions
  for select to authenticated using (public.current_user_has_permission('admin.manage_catalogue'));
grant select on public.multishot_composition_versions to authenticated;

create function public.save_multishot_composition(p_id uuid, p_expected_updated_at timestamptz, p_shots jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target public.multishots;
  before_shots jsonb;
  after_shots jsonb;
  shot jsonb;
  shot_index integer := 0;
  history_id uuid;
  revision timestamptz;
  previous_time_seconds numeric := 0;
  max_shot_count constant integer := 2000; -- multishot_fireworks_sequence_range, shots.
  max_pan_degrees constant integer := 30; -- multishot_fireworks_pan_range, degrees.
  max_duration_seconds constant numeric := 3600; -- multishot_fireworks_time_range, seconds.
  milliseconds_per_second constant integer := 1000; -- SI milliseconds per second.
begin
  if auth.uid() is null or not coalesce(public.current_user_has_permission('admin.manage_catalogue'), false) then
    return jsonb_build_object('ok', false, 'error', 'Not permitted.');
  end if;
  if p_expected_updated_at is null or p_shots is null or jsonb_typeof(p_shots) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'Invalid composition request.');
  end if;
  if jsonb_array_length(p_shots) not between 1 and max_shot_count then
    return jsonb_build_object('ok', false, 'error', 'Import between 1 and 2000 shots.');
  end if;
  -- Match the existing shot mutation lock order before locking the parent row.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('show-timeline-source-safety', 0));
  select * into target from public.multishots where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'Multishot was not found.'); end if;
  if target.updated_at <> p_expected_updated_at then
    return jsonb_build_object('ok', false, 'error', 'This multishot changed. Refresh before importing.');
  end if;
  for shot in select value from jsonb_array_elements(p_shots) loop
    shot_index := shot_index + 1;
    if (shot->>'sequence_index')::numeric <> shot_index
      or (shot->>'tilt_degrees')::integer <> 0
      or (shot->>'pan_degrees')::numeric <> trunc((shot->>'pan_degrees')::numeric)
      or abs((shot->>'pan_degrees')::numeric) > max_pan_degrees
      or (shot->>'time_offset_seconds')::numeric not between 0 and max_duration_seconds
      or (shot->>'time_offset_seconds')::numeric < previous_time_seconds
      or (shot->>'time_offset_seconds')::numeric * milliseconds_per_second <> trunc((shot->>'time_offset_seconds')::numeric * milliseconds_per_second)
      or (shot_index = 1 and (shot->>'time_offset_seconds')::numeric <> 0)
      or not exists (
        select 1 from public.fireworks f where f.id = (shot->>'firework_id')::uuid
          and f.design->>'kind' = 'shell' and jsonb_array_length(f.design->'breaks') = 1
          and f.name !~ '[+()\r\n]' and f.name !~* '\mCake\M'
      ) then
      return jsonb_build_object('ok', false, 'error', 'Every shot needs a valid single-break shell, firing time and pan angle.');
    end if;
    if not (shot ?& array['sequence_index','tilt_degrees','pan_degrees','time_offset_seconds','firework_id'])
      or shot->>'firework_id' is null or shot->>'pan_degrees' is null
      or shot->>'sequence_index' is null
      or shot->>'tilt_degrees' is null or shot->>'time_offset_seconds' is null then
      return jsonb_build_object('ok', false, 'error', 'Incomplete shot.');
    end if;
    previous_time_seconds := (shot->>'time_offset_seconds')::numeric;
  end loop;
  select coalesce(jsonb_agg(to_jsonb(s) order by s.sequence_index), '[]') into before_shots
    from public.multishot_fireworks s where s.multishot_id = p_id;
  -- Existing triggers enforce timing, catalogue synchronisation and preview invalidation.
  delete from public.multishot_fireworks where multishot_id = p_id;
  insert into public.multishot_fireworks(multishot_id,firework_id,sequence_index,timeline_track_index,time_offset_seconds,pan_degrees,tilt_degrees,caliber)
    select p_id, (value->>'firework_id')::uuid, (value->>'sequence_index')::integer,
      (value->>'sequence_index')::integer - 1, (value->>'time_offset_seconds')::numeric,
      (value->>'pan_degrees')::integer, 0, f.caliber
    from jsonb_array_elements(p_shots) join public.fireworks f on f.id = (value->>'firework_id')::uuid;
  perform private.sync_multishot_derived_state(p_id);
  update public.multishots set updated_at = clock_timestamp()
    where id = p_id returning updated_at into revision;
  select coalesce(jsonb_agg(to_jsonb(s) order by s.sequence_index), '[]') into after_shots
    from public.multishot_fireworks s where s.multishot_id = p_id;
  insert into public.multishot_composition_versions(multishot_id,actor_id,before_shots,after_shots)
    values(p_id,auth.uid(),before_shots,after_shots) returning id into history_id;
  return jsonb_build_object('ok',true,'historyId',history_id,'updatedAt',revision,'shots',after_shots,'durationSeconds',(select duration_seconds from public.multishots where id=p_id));
exception when invalid_text_representation or numeric_value_out_of_range or check_violation or foreign_key_violation or not_null_violation then
  -- PL/pgSQL rolls back the entire block, including deletions and trigger writes.
  return jsonb_build_object('ok',false,'error','The composition could not be saved. Check its effects, angles and duration.');
end $$;
revoke all on function public.save_multishot_composition(uuid,timestamptz,jsonb) from public, anon;
grant execute on function public.save_multishot_composition(uuid,timestamptz,jsonb) to authenticated;

commit;
