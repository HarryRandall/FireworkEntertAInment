begin;

-- Each committed edit needs a distinct revision, even for two saves in one transaction.
create or replace function private.touch_firework_editor_revision()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end $$;
revoke all on function private.touch_firework_editor_revision() from public, anon, authenticated;
create or replace trigger firework_effects_set_updated_at before update on public.firework_effects
  for each row execute function private.touch_firework_editor_revision();
create or replace trigger firework_style_defaults_set_updated_at before update on public.firework_style_defaults
  for each row execute function private.touch_firework_editor_revision();
create or replace trigger firework_variants_set_updated_at before update on public.fireworks
  for each row execute function private.touch_firework_editor_revision();

-- History is constructed from the locked database rows, never supplied by a client.
create or replace function private.firework_editor_snapshot(p_kind text, p_row jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare
  mapping jsonb;
  entry record;
  snapshot jsonb := jsonb_build_object('kind', p_kind);
begin
  mapping := '{"id":"id","name":"name","description":"description","updatedAt":"updated_at"}'::jsonb;
  case p_kind
    when 'effect' then
      mapping := mapping || '{"patternKey":"pattern_key","sortOrder":"sort_order","modelJson":"model_json"}'::jsonb;
    when 'firework' then
      mapping := mapping || '{"fireworkEffectId":"firework_effect_id","caliber":"caliber","durationSeconds":"duration_seconds","heightMeters":"height_meters","primaryColor":"primary_color","secondaryColor":"secondary_color","colorPalette":"color_palette","renderOverridesJson":"render_overrides_json"}'::jsonb;
      -- Backfilled fireworks retain their original overrides for provenance.
      p_row := jsonb_set(p_row, '{render_overrides_json}', coalesce(nullif(p_row->'render_snapshot_json', 'null'::jsonb), p_row->'render_overrides_json'));
    when 'style_default' then
      mapping := mapping || '{"styleKind":"kind","sortOrder":"sort_order","isArchived":"is_archived","defaultsJson":"defaults_json"}'::jsonb;
    else raise exception 'Invalid editor target' using errcode = '22023';
  end case;
  for entry in select * from jsonb_each_text(mapping) loop
    snapshot := snapshot || jsonb_build_object(entry.key, p_row->entry.value);
  end loop;
  if p_kind <> 'style_default' then
    snapshot := snapshot || jsonb_build_object('styleDefaultIds',
      (select jsonb_object_agg(kind, null) from unnest(array['geometry','star','innerStar','trail','innerTrail','launch','smoke','strobe','crackle','split','sound']) kind));
  end if;
  return snapshot;
end $$;
revoke all on function private.firework_editor_snapshot(text,jsonb) from public, anon, authenticated;

create or replace function public.save_firework_editor(
  p_kind text, p_id uuid, p_expected_updated_at timestamptz, p_patch jsonb,
  p_history_id uuid, p_action text default 'update', p_restore_version_id uuid default null,
  p_inline_style jsonb default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  effect public.firework_effects;
  firework public.fireworks;
  style public.firework_style_defaults;
  created_style public.firework_style_defaults;
  version public.firework_editor_versions;
  restored public.firework_editor_versions;
  before_row jsonb;
  after_row jsonb;
  before_snapshot jsonb;
  after_snapshot jsonb;
  changes jsonb := '{}'::jsonb;
  allowed text[];
  field record;
  actor_label text;
  summary text;
begin
  if auth.uid() is null or not coalesce(public.current_user_has_permission('admin.manage_catalogue'), false) then
    raise exception 'Not permitted.' using errcode = '42501';
  end if;
  if p_id is null or p_history_id is null or p_expected_updated_at is null
    or p_kind is null or p_kind not in ('effect','firework','style_default')
    or p_action is null or p_action not in ('update','restore')
    or p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'Invalid editor save request.' using errcode = '22023';
  end if;

  case p_kind
    when 'effect' then
      allowed := array['name','description','pattern_key','sort_order','model_json'];
      select * into effect from public.firework_effects where id = p_id for update;
      before_row := to_jsonb(effect);
    when 'firework' then
      allowed := array['name','description','firework_effect_id','caliber','duration_seconds','height_meters','primary_color','secondary_color','color_palette','render_overrides_json'];
      select * into firework from public.fireworks where id = p_id for update;
      before_row := to_jsonb(firework);
    when 'style_default' then
      allowed := array['name','description','kind','sort_order','is_archived','defaults_json'];
      select * into style from public.firework_style_defaults where id = p_id for update;
      before_row := to_jsonb(style);
  end case;
  if exists (select 1 from jsonb_object_keys(p_patch) key where not key = any(allowed)) then
    raise exception 'Unsupported editor field.' using errcode = '22023';
  end if;
  if before_row->>'id' is null or (before_row->>'updated_at')::timestamptz <> p_expected_updated_at then
    return jsonb_build_object('ok', false, 'code', 'conflict');
  end if;
  if p_action = 'restore' then
    select * into restored from public.firework_editor_versions
      where id = p_restore_version_id and target_kind = p_kind
        and coalesce(firework_id, firework_effect_id, firework_style_default_id) = p_id;
    if not found then raise exception 'That version could not be found.' using errcode = '22023'; end if;
    summary := 'Restored version from ' || restored.created_by_label;
  elsif p_restore_version_id is not null then
    raise exception 'A restore version requires a restore action.' using errcode = '22023';
  end if;
  if p_patch ? 'name' and coalesce(trim(p_patch->>'name'), '') = '' then
    raise exception 'Name is required.' using errcode = '22023';
  end if;
  if p_inline_style is not null and (p_action <> 'update' or p_kind = 'style_default'
    or jsonb_typeof(p_inline_style) <> 'object'
    or coalesce(trim(p_inline_style->>'name'), '') = ''
    or coalesce(trim(p_inline_style->>'slug'), '') = ''
    or coalesce(jsonb_typeof(p_inline_style->'defaults_json'), '') <> 'object') then
    raise exception 'Invalid inline preset.' using errcode = '22023';
  end if;

  before_snapshot := private.firework_editor_snapshot(p_kind, before_row);
  case p_kind
    when 'effect' then
      effect := jsonb_populate_record(effect, p_patch);
      update public.firework_effects set name = effect.name, description = effect.description,
        pattern_key = effect.pattern_key, sort_order = effect.sort_order, model_json = effect.model_json,
        updated_at = clock_timestamp()
        where id = p_id returning * into effect;
      after_row := to_jsonb(effect);
    when 'firework' then
      firework := jsonb_populate_record(firework, p_patch);
      update public.fireworks set name = firework.name, description = firework.description,
        firework_effect_id = firework.firework_effect_id, caliber = firework.caliber,
        duration_seconds = firework.duration_seconds, height_meters = firework.height_meters,
        primary_color = firework.primary_color, secondary_color = firework.secondary_color,
        color_palette = firework.color_palette, render_overrides_json = firework.render_overrides_json,
        updated_at = clock_timestamp()
        where id = p_id returning * into firework;
      after_row := to_jsonb(firework);
    when 'style_default' then
      style := jsonb_populate_record(style, p_patch);
      update public.firework_style_defaults set name = style.name, description = style.description,
        kind = style.kind, sort_order = style.sort_order, is_archived = style.is_archived,
        defaults_json = style.defaults_json, updated_at = clock_timestamp()
        where id = p_id returning * into style;
      after_row := to_jsonb(style);
  end case;

  if p_inline_style is not null then
    insert into public.firework_style_defaults (slug, name, description, kind, defaults_json, sort_order)
      values (p_inline_style->>'slug', p_inline_style->>'name', nullif(p_inline_style->>'description', ''),
        p_inline_style->>'kind', p_inline_style->'defaults_json', 9000)
      returning * into created_style;
  end if;
  after_snapshot := private.firework_editor_snapshot(p_kind, after_row);
  for field in select * from jsonb_each(after_snapshot - array['id','kind','updatedAt','styleDefaultIds']) loop
    if field.value is distinct from before_snapshot->field.key then
      changes := changes || jsonb_build_object(field.key, jsonb_build_object('before', before_snapshot->field.key, 'after', field.value));
    end if;
  end loop;
  if summary is null then
    summary := case when changes = '{}'::jsonb then 'Saved without visible field changes'
      when p_patch = '{"is_archived":true}'::jsonb then 'Archived style default'
      else 'Updated ' || case p_kind when 'effect' then 'effect' when 'firework' then 'firework' else 'style default' end end;
  end if;
  select coalesce(nullif(full_name,''), nullif(email,''), 'Platform admin') into actor_label
    from public.users where id = auth.uid();
  insert into public.firework_editor_versions
    (id, target_kind, firework_id, firework_effect_id, firework_style_default_id, action, summary,
     snapshot_json, previous_snapshot_json, changes_json, created_by, created_by_label)
    values (p_history_id, p_kind, case when p_kind = 'firework' then p_id end,
      case when p_kind = 'effect' then p_id end, case when p_kind = 'style_default' then p_id end,
      p_action, summary, after_snapshot, before_snapshot, changes, auth.uid(), coalesce(actor_label, 'Platform admin'))
    returning * into version;
  return jsonb_build_object('ok', true, 'kind', p_kind, 'saved', after_row,
    'historyVersion', to_jsonb(version), 'styleDefault', case when created_style.id is not null then to_jsonb(created_style) end);
end $$;
revoke all on function public.save_firework_editor(text,uuid,timestamptz,jsonb,uuid,text,uuid,jsonb) from public, anon;
grant execute on function public.save_firework_editor(text,uuid,timestamptz,jsonb,uuid,text,uuid,jsonb) to authenticated;
comment on function public.save_firework_editor(text,uuid,timestamptz,jsonb,uuid,text,uuid,jsonb) is
  'Saves an admin editor record, optional copied preset and immutable history in one guarded transaction.';
-- Superseded entry points omitted history and are no longer called by the app.
drop function if exists public.create_style_default_and_update_effect(uuid,timestamptz,text,text,text,integer,jsonb,text,text,text,text,jsonb);
drop function if exists public.create_style_default_and_update_firework(uuid,timestamptz,text,text,uuid,text,numeric,numeric,text,text,text[],jsonb,text,text,text,text,jsonb);
commit;
