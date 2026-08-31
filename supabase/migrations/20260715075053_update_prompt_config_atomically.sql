-- Keep admin prompt writes behind narrowly granted functions. Authenticated
-- clients can read these tables through RLS, but cannot bypass the atomic
-- prompt update or the live-account check with direct Data API writes.

drop policy if exists prompt_configs_admin_manage on public.prompt_configs;
drop policy if exists prompt_configs_admin_read on public.prompt_configs;
create policy prompt_configs_admin_read on public.prompt_configs
  for select to authenticated
  using (
    (select public.current_user_is_active())
    and (select public.current_user_has_permission('admin.manage_prompts'))
  );

drop policy if exists generation_settings_admin_manage on public.generation_settings;
drop policy if exists generation_settings_admin_read on public.generation_settings;
create policy generation_settings_admin_read on public.generation_settings
  for select to authenticated
  using (
    (select public.current_user_is_active())
    and (select public.current_user_has_permission('admin.manage_prompts'))
  );

revoke all privileges on table public.prompt_configs from authenticated;
revoke all privileges on table public.generation_settings from authenticated;
grant select on table public.prompt_configs, public.generation_settings to authenticated;

create or replace function public.update_prompt_config_atomically(
  p_key text,
  p_system_prompt_text text default null,
  p_product_context_text text default null,
  p_product_catalogue_fields jsonb default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := auth.uid();
begin
  if v_caller_id is null
    or not coalesce(public.current_user_is_active(), false)
    or not coalesce(public.current_user_has_permission('admin.manage_prompts'), false) then
    raise exception using
      errcode = '42501',
      message = 'Not permitted.';
  end if;

  if p_key is null
    or p_key not in ('show_cue_generation', 'firework_video_reconstruction')
    or (
      p_system_prompt_text is null
      and p_product_context_text is null
      and p_product_catalogue_fields is null
    )
    or (
      p_system_prompt_text is not null
      and (
        length(trim(p_system_prompt_text)) < 40
        or length(p_system_prompt_text) > 60000
      )
    )
    or (
      p_product_context_text is not null
      and (
        p_key <> 'show_cue_generation'
        or length(p_product_context_text) > 20000
      )
    ) then
    raise exception using
      errcode = '22023',
      message = 'Invalid prompt configuration request.';
  end if;

  if p_product_catalogue_fields is not null then
    if p_key <> 'show_cue_generation'
      or jsonb_typeof(p_product_catalogue_fields) is distinct from 'array' then
      raise exception using
        errcode = '22023',
        message = 'Invalid product catalogue fields.';
    end if;

    if jsonb_array_length(p_product_catalogue_fields) = 0
      or not p_product_catalogue_fields @> '["id"]'::jsonb
      or exists (
        select 1
        from jsonb_array_elements_text(p_product_catalogue_fields) as field(value)
        where field.value not in (
          'id',
          'name',
          'description',
          'durationSeconds',
          'shotCount',
          'isMultiShot',
          'heightMeters',
          'caliber',
          'shellType',
          'color',
          'colorPalette',
          'effects'
        )
      )
      or jsonb_array_length(p_product_catalogue_fields) <> (
        select count(distinct field.value)
        from jsonb_array_elements_text(p_product_catalogue_fields) as field(value)
      ) then
      raise exception using
        errcode = '22023',
        message = 'Invalid product catalogue fields.';
    end if;
  end if;

  update public.prompt_configs
  set
    system_prompt_text = coalesce(p_system_prompt_text, system_prompt_text),
    product_context_text = case
      when p_product_context_text is null then product_context_text
      else p_product_context_text
    end,
    updated_by = v_caller_id
  where key = p_key;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Prompt configuration was not found.';
  end if;

  if p_product_catalogue_fields is not null then
    update public.generation_settings
    set
      product_catalogue_fields = p_product_catalogue_fields,
      updated_by = v_caller_id
    where key = 'show_cue_generation';

    if not found then
      raise exception using
        errcode = 'P0002',
        message = 'Show generation settings were not found.';
    end if;
  end if;

  return true;
end;
$$;

comment on function public.update_prompt_config_atomically(text, text, text, jsonb) is
  'Atomically updates one admin prompt and its optional show-generation catalogue fields.';

revoke execute on function public.update_prompt_config_atomically(text, text, text, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.update_prompt_config_atomically(text, text, text, jsonb)
  to authenticated;

create or replace function public.update_show_generation_mode(p_generation_mode text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := auth.uid();
begin
  if v_caller_id is null
    or not coalesce(public.current_user_is_active(), false)
    or not coalesce(public.current_user_has_permission('admin.manage_prompts'), false) then
    raise exception using
      errcode = '42501',
      message = 'Not permitted.';
  end if;

  if p_generation_mode is null or p_generation_mode not in ('fast', 'llm') then
    raise exception using
      errcode = '22023',
      message = 'Invalid generation mode.';
  end if;

  update public.generation_settings
  set
    generation_mode = p_generation_mode,
    updated_by = v_caller_id
  where key = 'show_cue_generation';

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Show generation settings were not found.';
  end if;

  return true;
end;
$$;

comment on function public.update_show_generation_mode(text) is
  'Updates the show-generation planner mode for an active prompt administrator.';

revoke execute on function public.update_show_generation_mode(text)
  from public, anon, authenticated, service_role;
grant execute on function public.update_show_generation_mode(text)
  to authenticated;
