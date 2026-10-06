begin;
CREATE OR REPLACE FUNCTION "public"."update_prompt_config_atomically"("p_key" "text", "p_system_prompt_text" "text" DEFAULT NULL::"text", "p_product_context_text" "text" DEFAULT NULL::"text", "p_product_catalogue_fields" "jsonb" DEFAULT NULL::"jsonb") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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
          'templateKey',
          'kind',
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


alter table public.generation_settings alter column product_catalogue_fields set default '["id", "name", "description", "durationSeconds", "shotCount", "isMultiShot", "heightMeters", "caliber", "templateKey", "kind", "color", "colorPalette", "effects"]'::jsonb;
update public.generation_settings
set product_catalogue_fields = (select jsonb_agg(distinct field) from jsonb_array_elements_text(product_catalogue_fields - 'shellType') field) || '["templateKey","kind"]'::jsonb
where product_catalogue_fields ? 'shellType';

commit;
