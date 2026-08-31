-- Keep inline style-default creation and its parent editor save atomic. Both
-- functions run with elevated table privileges, so each independently checks
-- the authenticated caller's catalogue permission before touching data.

create or replace function public.create_style_default_and_update_effect(
  p_effect_id uuid,
  p_expected_updated_at timestamptz,
  p_effect_name text,
  p_effect_description text,
  p_pattern_key text,
  p_sort_order integer,
  p_model_json jsonb,
  p_style_slug text,
  p_style_name text,
  p_style_description text,
  p_style_kind text,
  p_style_defaults_json jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_effect public.firework_effects%rowtype;
  v_style_default public.firework_style_defaults%rowtype;
begin
  if auth.uid() is null
    or not coalesce(public.current_user_has_permission('admin.manage_catalogue'), false) then
    raise exception using
      errcode = '42501',
      message = 'Not permitted.';
  end if;

  if p_effect_id is null
    or p_expected_updated_at is null
    or coalesce(trim(p_effect_name), '') = ''
    or coalesce(trim(p_pattern_key), '') = ''
    or p_sort_order is null
    or p_model_json is null
    or jsonb_typeof(p_model_json) <> 'object'
    or coalesce(trim(p_style_slug), '') = ''
    or coalesce(trim(p_style_name), '') = ''
    or p_style_kind is null
    or p_style_kind not in (
      'geometry',
      'star',
      'trail',
      'launch',
      'smoke',
      'strobe',
      'crackle',
      'split',
      'sound'
    )
    or p_style_defaults_json is null
    or jsonb_typeof(p_style_defaults_json) <> 'object' then
    raise exception using
      errcode = '22023',
      message = 'Invalid editor style-default request.';
  end if;

  update public.firework_effects
  set
    name = p_effect_name,
    description = nullif(p_effect_description, ''),
    pattern_key = p_pattern_key,
    sort_order = p_sort_order,
    model_json = p_model_json
  where id = p_effect_id
    and updated_at = p_expected_updated_at
  returning * into v_effect;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'conflict');
  end if;

  insert into public.firework_style_defaults (
    slug,
    name,
    description,
    kind,
    defaults_json,
    sort_order
  )
  values (
    p_style_slug,
    p_style_name,
    nullif(p_style_description, ''),
    p_style_kind,
    p_style_defaults_json,
    9000
  )
  returning * into v_style_default;

  return jsonb_build_object(
    'ok', true,
    'effect', to_jsonb(v_effect),
    'styleDefault', to_jsonb(v_style_default)
  );
end;
$$;

comment on function public.create_style_default_and_update_effect(
  uuid,
  timestamptz,
  text,
  text,
  text,
  integer,
  jsonb,
  text,
  text,
  text,
  text,
  jsonb
) is
  'Atomically updates one effect with conflict detection and creates an inline editor style default.';

revoke execute on function public.create_style_default_and_update_effect(
  uuid,
  timestamptz,
  text,
  text,
  text,
  integer,
  jsonb,
  text,
  text,
  text,
  text,
  jsonb
) from public, anon, authenticated;
grant execute on function public.create_style_default_and_update_effect(
  uuid,
  timestamptz,
  text,
  text,
  text,
  integer,
  jsonb,
  text,
  text,
  text,
  text,
  jsonb
) to authenticated;

create or replace function public.create_style_default_and_update_firework(
  p_firework_id uuid,
  p_expected_updated_at timestamptz,
  p_firework_name text,
  p_firework_description text,
  p_firework_effect_id uuid,
  p_caliber text,
  p_duration_seconds numeric,
  p_height_meters numeric,
  p_primary_color text,
  p_secondary_color text,
  p_color_palette text[],
  p_render_overrides_json jsonb,
  p_style_slug text,
  p_style_name text,
  p_style_description text,
  p_style_kind text,
  p_style_defaults_json jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_firework public.fireworks%rowtype;
  v_style_default public.firework_style_defaults%rowtype;
begin
  if auth.uid() is null
    or not coalesce(public.current_user_has_permission('admin.manage_catalogue'), false) then
    raise exception using
      errcode = '42501',
      message = 'Not permitted.';
  end if;

  if p_firework_id is null
    or p_expected_updated_at is null
    or coalesce(trim(p_firework_name), '') = ''
    or p_firework_effect_id is null
    or p_render_overrides_json is null
    or jsonb_typeof(p_render_overrides_json) <> 'object'
    or coalesce(trim(p_style_slug), '') = ''
    or coalesce(trim(p_style_name), '') = ''
    or p_style_kind is null
    or p_style_kind not in (
      'geometry',
      'star',
      'trail',
      'launch',
      'smoke',
      'strobe',
      'crackle',
      'split',
      'sound'
    )
    or p_style_defaults_json is null
    or jsonb_typeof(p_style_defaults_json) <> 'object' then
    raise exception using
      errcode = '22023',
      message = 'Invalid editor style-default request.';
  end if;

  update public.fireworks
  set
    name = p_firework_name,
    description = p_firework_description,
    firework_effect_id = p_firework_effect_id,
    caliber = p_caliber,
    duration_seconds = p_duration_seconds,
    height_meters = p_height_meters,
    primary_color = p_primary_color,
    secondary_color = p_secondary_color,
    color_palette = coalesce(p_color_palette, '{}'::text[]),
    render_overrides_json = p_render_overrides_json,
    updated_at = clock_timestamp()
  where id = p_firework_id
    and updated_at = p_expected_updated_at
  returning * into v_firework;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'conflict');
  end if;

  insert into public.firework_style_defaults (
    slug,
    name,
    description,
    kind,
    defaults_json,
    sort_order
  )
  values (
    p_style_slug,
    p_style_name,
    p_style_description,
    p_style_kind,
    p_style_defaults_json,
    9000
  )
  returning * into v_style_default;

  return jsonb_build_object(
    'ok', true,
    'firework', to_jsonb(v_firework),
    'styleDefault', to_jsonb(v_style_default)
  );
end;
$$;

comment on function public.create_style_default_and_update_firework(
  uuid,
  timestamptz,
  text,
  text,
  uuid,
  text,
  numeric,
  numeric,
  text,
  text,
  text[],
  jsonb,
  text,
  text,
  text,
  text,
  jsonb
) is
  'Atomically updates one firework with conflict detection and creates an inline editor style default.';

revoke execute on function public.create_style_default_and_update_firework(
  uuid,
  timestamptz,
  text,
  text,
  uuid,
  text,
  numeric,
  numeric,
  text,
  text,
  text[],
  jsonb,
  text,
  text,
  text,
  text,
  jsonb
) from public, anon, authenticated;
grant execute on function public.create_style_default_and_update_firework(
  uuid,
  timestamptz,
  text,
  text,
  uuid,
  text,
  numeric,
  numeric,
  text,
  text,
  text[],
  jsonb,
  text,
  text,
  text,
  text,
  jsonb
) to authenticated;
