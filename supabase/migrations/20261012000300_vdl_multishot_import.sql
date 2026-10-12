begin;

-- Admin-edited Finale VDL words. A row replaces the built-in meaning of its phrase in the importer.
create table public.vdl_glossary_terms (
  id uuid primary key default gen_random_uuid(),
  phrase text not null unique
    check (phrase = lower(btrim(phrase)) and char_length(phrase) between 1 and 80 and phrase !~ '[[:cntrl:]]'),
  definition jsonb not null check (jsonb_typeof(definition) = 'object' and definition ? 'type'),
  notes text check (char_length(coalesce(notes, '')) <= 500),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.vdl_glossary_terms is
  'Catalogue-admin overrides and additions to the built-in Finale VDL word list used by multishot import.';
create trigger vdl_glossary_terms_set_updated_at before update on public.vdl_glossary_terms
  for each row execute function public.set_updated_at();
alter table public.vdl_glossary_terms enable row level security;
revoke all on public.vdl_glossary_terms from public, anon, authenticated;
create policy vdl_glossary_terms_admin_read on public.vdl_glossary_terms
  for select to authenticated using (public.current_user_has_permission('admin.manage_catalogue'));
create policy vdl_glossary_terms_admin_insert on public.vdl_glossary_terms
  for insert to authenticated with check (public.current_user_has_permission('admin.manage_catalogue'));
create policy vdl_glossary_terms_admin_update on public.vdl_glossary_terms
  for update to authenticated using (public.current_user_has_permission('admin.manage_catalogue'))
  with check (public.current_user_has_permission('admin.manage_catalogue'));
create policy vdl_glossary_terms_admin_delete on public.vdl_glossary_terms
  for delete to authenticated using (public.current_user_has_permission('admin.manage_catalogue'));
grant select, insert, update, delete on public.vdl_glossary_terms to authenticated;

-- Creates the missing fireworks, the multishot and its shots in one transaction.
create function public.create_vdl_multishot(
  p_name text, p_description text, p_fireworks jsonb, p_shots jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  firework jsonb;
  shot jsonb;
  created jsonb := '{}'::jsonb;
  created_id uuid;
  effect_id uuid;
  v_multishot_id uuid;
  v_firework_id uuid;
  shot_index integer := 0;
  previous_time_seconds numeric := 0;
  after_shots jsonb;
  max_shot_count constant integer := 2000; -- multishot_fireworks_sequence_range, shots.
  max_pan_degrees constant integer := 30; -- multishot_fireworks_pan_range, degrees.
  max_duration_seconds constant numeric := 3600; -- multishot_fireworks_time_range, seconds.
  milliseconds_per_second constant integer := 1000; -- SI milliseconds per second.
begin
  if auth.uid() is null or not coalesce(public.current_user_has_permission('admin.manage_catalogue'), false) then
    return jsonb_build_object('ok', false, 'error', 'Not permitted.');
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 180
    or char_length(coalesce(p_description, '')) > 5000
    or p_fireworks is null or jsonb_typeof(p_fireworks) <> 'array'
    or p_shots is null or jsonb_typeof(p_shots) <> 'array'
    or jsonb_array_length(p_fireworks) > max_shot_count
    or jsonb_array_length(p_shots) not between 1 and max_shot_count then
    return jsonb_build_object('ok', false, 'error', 'Invalid multishot import.');
  end if;
  -- Match the existing shot mutation lock order.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('show-timeline-source-safety', 0));

  for firework in select value from jsonb_array_elements(p_fireworks) loop
    if jsonb_typeof(firework) <> 'object'
      or coalesce(btrim(firework->>'key'), '') = '' or created ? (firework->>'key')
      or coalesce(btrim(firework->>'template_key'), '') = '' or length(firework->>'template_key') > 80
      or coalesce(btrim(firework->>'name'), '') = '' or char_length(btrim(firework->>'name')) > 180
      or jsonb_typeof(firework->'design') is distinct from 'object'
      or jsonb_typeof(firework->'template_design') is distinct from 'object'
      or coalesce(btrim(firework->>'template_name'), '') = '' or char_length(firework->>'template_name') > 180
      or jsonb_typeof(firework->'model') is distinct from 'object'
      or jsonb_typeof(firework->'render_snapshot') is distinct from 'object'
      or not (firework->'render_snapshot' ? 'geometry')
      or (firework->>'duration_seconds')::numeric not between 0 and max_duration_seconds
      or char_length(coalesce(firework->>'caliber', '')) > 40 then
      return jsonb_build_object('ok', false, 'error', 'A new firework in this import is invalid.');
    end if;
    insert into public.firework_effects (slug, name, pattern_key, source, model_json, template_key, design)
      values ('template-' || gen_random_uuid()::text, btrim(firework->>'template_name'), firework->>'template_key',
        'manual', firework->'model', firework->>'template_key', firework->'template_design')
      on conflict (template_key) where template_key is not null do nothing;
    select id into effect_id from public.firework_effects where template_key = firework->>'template_key';
    created_id := gen_random_uuid();
    insert into public.fireworks (id, slug, name, firework_effect_id, source, design, render_overrides_json,
      duration_seconds, caliber, height_meters)
      values (created_id, 'vdl-' || created_id::text, btrim(firework->>'name'), effect_id, 'manual',
        firework->'design', firework->'render_snapshot', nullif((firework->>'duration_seconds')::numeric, 0),
        nullif(btrim(coalesce(firework->>'caliber', '')), ''), (firework->>'height_meters')::numeric);
    -- Imported parts are renderer components of the cake, not separate products.
    update public.catalogue_items set is_listed = false where catalogue_items.firework_id = created_id;
    created := created || jsonb_build_object(firework->>'key', created_id);
  end loop;

  insert into public.multishots (slug, name, description, shot_count)
    values (
      coalesce(nullif(btrim(regexp_replace(lower(btrim(p_name)), '[^a-z0-9]+', '-', 'g'), '-'), ''), 'multishot')
        || '-' || left(replace(gen_random_uuid()::text, '-', ''), 6),
      btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''), 0)
    returning id into v_multishot_id;

  for shot in select value from jsonb_array_elements(p_shots) loop
    shot_index := shot_index + 1;
    v_firework_id := case
      when shot ? 'firework_key' then (created->>(shot->>'firework_key'))::uuid
      else (shot->>'firework_id')::uuid end;
    if jsonb_typeof(shot) <> 'object' or v_firework_id is null
      or (shot->>'sequence_index')::numeric <> shot_index
      or (shot->>'pan_degrees')::numeric <> trunc((shot->>'pan_degrees')::numeric)
      or abs((shot->>'pan_degrees')::numeric) > max_pan_degrees
      or (shot->>'timeline_track_index')::numeric <> trunc((shot->>'timeline_track_index')::numeric)
      or (shot->>'timeline_track_index')::numeric not between 0 and max_shot_count - 1
      or (shot->>'time_offset_seconds')::numeric not between 0 and max_duration_seconds
      or (shot->>'time_offset_seconds')::numeric < previous_time_seconds
      or (shot->>'time_offset_seconds')::numeric * milliseconds_per_second
        <> trunc((shot->>'time_offset_seconds')::numeric * milliseconds_per_second)
      or not exists (select 1 from public.fireworks f where f.id = v_firework_id) then
      raise exception 'Invalid shot.' using errcode = '22023';
    end if;
    previous_time_seconds := (shot->>'time_offset_seconds')::numeric;
    insert into public.multishot_fireworks (multishot_id, firework_id, sequence_index, timeline_track_index,
      time_offset_seconds, pan_degrees, tilt_degrees, caliber)
      select v_multishot_id, f.id, shot_index, (shot->>'timeline_track_index')::integer,
        (shot->>'time_offset_seconds')::numeric, (shot->>'pan_degrees')::integer, 0, f.caliber
      from public.fireworks f where f.id = v_firework_id;
  end loop;
  perform private.sync_multishot_derived_state(v_multishot_id);
  select coalesce(jsonb_agg(to_jsonb(s) order by s.sequence_index), '[]') into after_shots
    from public.multishot_fireworks s where s.multishot_id = v_multishot_id;
  insert into public.multishot_composition_versions (multishot_id, actor_id, before_shots, after_shots)
    values (v_multishot_id, auth.uid(), '[]'::jsonb, after_shots);
  return jsonb_build_object('ok', true, 'id', v_multishot_id, 'createdFireworks', created);
exception when invalid_text_representation or numeric_value_out_of_range or check_violation
  or foreign_key_violation or not_null_violation or invalid_parameter_value then
  -- PL/pgSQL rolls back every insert in this block, including created fireworks.
  return jsonb_build_object('ok', false, 'error',
    'The multishot could not be created. Check its effects, angles and timing.');
end $$;
revoke all on function public.create_vdl_multishot(text, text, jsonb, jsonb) from public, anon;
grant execute on function public.create_vdl_multishot(text, text, jsonb, jsonb) to authenticated;
comment on function public.create_vdl_multishot(text, text, jsonb, jsonb) is
  'Creates fireworks described by a Finale VDL line, then the multishot and its shots, atomically for a catalogue administrator.';

commit;
