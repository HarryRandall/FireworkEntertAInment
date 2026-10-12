-- Video imports now fit renderer v1 designs headlessly in the worker instead of
-- rendering old-engine candidates in a browser harness. Candidates carry a
-- version 2 reconstruction (renderer designs per letter plus timed shots) and the
-- worker's per-shot fit evidence. Approval writes fireworks.design directly, so
-- imported fireworks play in shows. The browser render seal and its contract
-- versions are retired; historical seals stay in
-- import_candidate_render_validations until the old renderer data is removed.
begin;

create or replace function public.current_firework_import_validator_version() returns text
language sql immutable parallel safe set search_path = '' as $$
  select 'showcrafter.firework-reconstruction.v2'::text;
$$;

drop function public.seal_firework_import_render_validation(uuid, text, jsonb, text);
drop function public.current_firework_import_render_validator_version();
drop function public.current_firework_import_renderer_contract_version();

-- Structural checks for a version 2 reconstruction; renderer designs are checked
-- against the stored design schema, and every template must name a catalogue effect.
create or replace function private.firework_import_reconstruction_v2_issue(p_reconstruction jsonb)
returns text language plpgsql stable set search_path = '' as $$
declare
  max_designs constant integer := 64; -- import_candidates contract, designs.
  max_shots constant integer := 500; -- import_candidates contract, shots.
  max_pan_degrees constant integer := 30; -- multishot_fireworks_pan_range, degrees.
  max_product_seconds constant numeric := 120; -- 60 s source plus the last shot's fade.
  max_palette_colours constant integer := 6; -- fireworks.color_palette display limit.
  product_seconds numeric;
begin
  if jsonb_typeof(p_reconstruction) is distinct from 'object'
    or (p_reconstruction ->> 'version') is distinct from '2'
    or jsonb_typeof(p_reconstruction -> 'designs') is distinct from 'array'
    or jsonb_array_length(p_reconstruction -> 'designs') not between 1 and max_designs
    or jsonb_typeof(p_reconstruction -> 'shots') is distinct from 'array'
    or jsonb_array_length(p_reconstruction -> 'shots') not between 1 and max_shots
    or jsonb_typeof(p_reconstruction -> 'durationSeconds') is distinct from 'number' then
    return 'The reconstruction contract is malformed.';
  end if;
  product_seconds := (p_reconstruction ->> 'durationSeconds')::numeric;
  if product_seconds <= 0 or product_seconds > max_product_seconds then
    return 'The reconstruction duration is invalid.';
  end if;
  if (
    select count(distinct design ->> 'key') <> count(*)
    from jsonb_array_elements(p_reconstruction -> 'designs') design
  ) then
    return 'A reconstructed design is duplicated.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_reconstruction -> 'designs') design
    where coalesce(design ->> 'key', '') !~ '^[a-z]{1,2}$'
      or char_length(coalesce(design ->> 'template', '')) not between 1 and 80
      or jsonb_typeof(design -> 'design') is distinct from 'object'
      or not extensions.jsonb_matches_schema(private.firework_design_schema(), design -> 'design')
      or jsonb_typeof(design -> 'durationSeconds') is distinct from 'number'
      or (design ->> 'durationSeconds')::numeric not between 0.001 and max_product_seconds
      or jsonb_typeof(coalesce(design -> 'colorPalette', '[]'::jsonb)) is distinct from 'array'
      or jsonb_array_length(coalesce(design -> 'colorPalette', '[]'::jsonb)) > max_palette_colours
      or exists (
        select 1
        from jsonb_array_elements(coalesce(design -> 'colorPalette', '[]'::jsonb)) colour
        where jsonb_typeof(colour) is distinct from 'string' or colour #>> '{}' !~* '^#[0-9a-f]{6}$'
      )
  ) then
    return 'A reconstructed design is not a valid renderer design.';
  end if;
  -- firework_effects has its own design column, so the element alias must differ.
  if exists (
    select 1
    from jsonb_array_elements(p_reconstruction -> 'designs') entry
    where not exists (
      select 1 from public.firework_effects effect where effect.template_key = entry ->> 'template'
    )
  ) then
    return 'A reconstructed design uses a template without a catalogue effect.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_reconstruction -> 'shots') shot
    left join jsonb_array_elements(p_reconstruction -> 'designs') design
      on design ->> 'key' = shot ->> 'designKey'
    where design is null
      or jsonb_typeof(shot -> 'timeOffsetSeconds') is distinct from 'number'
      or (shot ->> 'timeOffsetSeconds')::numeric < 0
      or (shot ->> 'timeOffsetSeconds')::numeric + (design ->> 'durationSeconds')::numeric
        > product_seconds + 0.001
      or jsonb_typeof(shot -> 'panDegrees') is distinct from 'number'
      or (shot ->> 'panDegrees')::numeric <> trunc((shot ->> 'panDegrees')::numeric)
      or abs((shot ->> 'panDegrees')::numeric) > max_pan_degrees
  ) then
    return 'A reconstructed shot is outside the supported bounds.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_reconstruction -> 'designs') design
    where not exists (
      select 1 from jsonb_array_elements(p_reconstruction -> 'shots') shot
      where shot ->> 'designKey' = design ->> 'key'
    )
  ) then
    return 'Every reconstructed design must be used by at least one shot.';
  end if;
  return null;
end;
$$;
revoke all on function private.firework_import_reconstruction_v2_issue(jsonb) from public, anon, authenticated;
grant execute on function private.firework_import_reconstruction_v2_issue(jsonb) to service_role;

create or replace function public.seal_firework_import_candidate(
  p_candidate_id uuid, p_validator_version text, p_canonical_reconstruction jsonb, p_content_hash text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  candidate_row public.import_candidates;
  existing_seal public.import_candidate_validations;
  issue text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only the trusted application validator can seal a candidate.' using errcode = '42501';
  end if;
  if btrim(coalesce(p_validator_version, '')) is distinct from public.current_firework_import_validator_version()
    or coalesce(p_content_hash, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'The canonical reconstruction seal is malformed.' using errcode = '22023';
  end if;
  issue := private.firework_import_reconstruction_v2_issue(p_canonical_reconstruction);
  if issue is not null then
    raise exception '%', issue using errcode = '22023';
  end if;

  select candidate.* into candidate_row
  from public.import_candidates candidate
  join public.import_runs run on run.id = candidate.import_run_id
  where candidate.id = p_candidate_id
    and run.status = 'succeeded'
  for share of candidate, run;
  if not found then
    raise exception 'Completed reconstruction candidate not found.' using errcode = 'P0002';
  end if;
  if candidate_row.content_hash is distinct from p_content_hash
    or candidate_row.reconstruction is distinct from p_canonical_reconstruction then
    raise exception 'The trusted canonical reconstruction is not bound to the immutable candidate.'
      using errcode = '55000';
  end if;

  insert into public.import_candidate_validations (
    candidate_id, validator_version, canonical_reconstruction, content_hash
  ) values (
    p_candidate_id, btrim(p_validator_version), p_canonical_reconstruction, p_content_hash
  )
  on conflict (candidate_id, validator_version) do nothing;

  select * into existing_seal
  from public.import_candidate_validations
  where candidate_id = p_candidate_id
    and validator_version = btrim(p_validator_version);
  if existing_seal.content_hash <> p_content_hash
    or existing_seal.canonical_reconstruction <> p_canonical_reconstruction then
    raise exception 'This candidate was already sealed with different canonical data.' using errcode = '55000';
  end if;
  return p_candidate_id;
end;
$$;

create or replace function public.approve_firework_import_candidate(
  p_job_id uuid, p_candidate_id uuid, p_part_number text, p_name text,
  p_manufacturer text default null, p_category text default null, p_firework_type text default null
) returns table(catalogue_item_id uuid, firework_ids uuid[], multishot_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  job_row public.import_jobs;
  active_run_status text;
  candidate_row public.import_candidates;
  reconstruction jsonb;
  fit_evidence jsonb;
  design_entry jsonb;
  shot_entry jsonb;
  design_key text;
  effect_id uuid;
  new_firework_id uuid;
  design_ids jsonb := '{}'::jsonb;
  colours text[];
  shot_count integer;
  shot_index integer := 0;
  generated_multishot_id uuid;
  generated_catalogue_item_id uuid;
  generated_firework_ids uuid[] := '{}'::uuid[];
  computed_approval_request_hash text;
  issue text;
begin
  if auth.uid() is null
    or not public.current_user_has_permission('admin.manage_imports')
    or not public.current_user_has_permission('admin.manage_catalogue') then
    raise exception 'You do not have permission to approve imports.' using errcode = '42501';
  end if;
  if char_length(btrim(p_part_number)) not between 1 and 80
    or char_length(btrim(p_name)) not between 1 and 180
    or char_length(coalesce(p_manufacturer, '')) > 120
    or char_length(coalesce(p_category, '')) > 80
    or char_length(coalesce(p_firework_type, '')) > 80 then
    raise exception 'Invalid catalogue metadata.' using errcode = '22023';
  end if;

  computed_approval_request_hash := private.firework_import_sha256(
    jsonb_build_object(
      'candidateId', p_candidate_id,
      'partNumber', btrim(p_part_number),
      'name', btrim(p_name),
      'manufacturer', nullif(btrim(coalesce(p_manufacturer, '')), ''),
      'category', nullif(btrim(coalesce(p_category, '')), ''),
      'fireworkType', nullif(btrim(coalesce(p_firework_type, '')), '')
    )::text
  );

  select * into job_row from public.import_jobs where id = p_job_id for update;
  if not found or job_row.kind <> 'firework_video' or job_row.archived_at is not null then
    raise exception 'Active firework video import not found.' using errcode = 'P0002';
  end if;
  if job_row.active_run_id is not null then
    select run.status into active_run_status
    from public.import_runs run
    where run.id = job_row.active_run_id
    for update;
    if active_run_status in ('queued', 'processing') then
      raise exception 'Wait for the active reconstruction run before approval.' using errcode = '55000';
    end if;
  end if;

  if job_row.approved_catalogue_item_id is not null then
    if job_row.approved_candidate_id <> p_candidate_id then
      raise exception 'This import has already approved a different candidate.' using errcode = '55000';
    end if;
    if job_row.approval_request_hash is distinct from computed_approval_request_hash then
      raise exception 'This import was already approved with different catalogue metadata.'
        using errcode = '55000';
    end if;
    select
      item.id,
      case
        when item.firework_id is not null then array[item.firework_id]
        else coalesce((
          select array_agg(shot.firework_id order by shot.sequence_index)
          from public.multishot_fireworks shot
          where shot.multishot_id = item.multishot_id
        ), '{}'::uuid[])
      end,
      item.multishot_id
    into generated_catalogue_item_id, generated_firework_ids, generated_multishot_id
    from public.catalogue_items item
    where item.id = job_row.approved_catalogue_item_id;
    if generated_catalogue_item_id is null then
      raise exception 'The approved catalogue item no longer exists.' using errcode = '55000';
    end if;
    return query select generated_catalogue_item_id, generated_firework_ids, generated_multishot_id;
    return;
  end if;

  select candidate.* into candidate_row
  from public.import_candidates candidate
  join public.import_runs run on run.id = candidate.import_run_id
  where candidate.id = p_candidate_id
    and run.import_job_id = p_job_id
    and run.status = 'succeeded'
  for update of candidate;
  if not found or job_row.selected_candidate_id <> p_candidate_id then
    raise exception 'The selected reconstruction candidate is stale.' using errcode = '55000';
  end if;
  if coalesce((candidate_row.validation ->> 'valid')::boolean, false) is not true then
    raise exception 'The reconstruction candidate has not passed validation.' using errcode = '22023';
  end if;

  select seal.canonical_reconstruction into reconstruction
  from public.import_candidate_validations seal
  where seal.candidate_id = candidate_row.id
    and seal.validator_version = public.current_firework_import_validator_version();
  if reconstruction is null then
    raise exception 'The reconstruction candidate has not passed the trusted renderer validator.'
      using errcode = '55000';
  end if;
  issue := private.firework_import_reconstruction_v2_issue(reconstruction);
  if issue is not null then
    raise exception '%', issue using errcode = '22023';
  end if;
  shot_count := jsonb_array_length(reconstruction -> 'shots');

  -- The worker scores every shot against the renderer before a candidate is stored.
  fit_evidence := candidate_row.metrics -> 'fit';
  if jsonb_typeof(fit_evidence) is distinct from 'object'
    or fit_evidence ->> 'schemaVersion' is distinct from 'showcrafter.import-fit-evidence.v1'
    or char_length(coalesce(fit_evidence ->> 'rendererVersion', '')) not between 1 and 80
    or jsonb_typeof(fit_evidence -> 'shots') is distinct from 'array'
    or jsonb_array_length(fit_evidence -> 'shots') <> shot_count then
    raise exception 'The reconstruction candidate has no renderer fit evidence.' using errcode = '55000';
  end if;

  for design_entry in select value from jsonb_array_elements(reconstruction -> 'designs') loop
    design_key := design_entry ->> 'key';
    select effect.id into effect_id
    from public.firework_effects effect
    where effect.template_key = design_entry ->> 'template';
    select coalesce(array_agg(lower(colour)), '{}'::text[]) into colours
    from jsonb_array_elements_text(coalesce(design_entry -> 'colorPalette', '[]'::jsonb)) colour;

    insert into public.fireworks (
      firework_effect_id, slug, name, description, primary_color, secondary_color, color_palette,
      duration_seconds, variant_json, source, confidence, design, design_schema
    ) values (
      effect_id,
      'import-' || left(replace(p_job_id::text, '-', ''), 12) || '-' || design_key,
      case when shot_count = 1 then btrim(p_name)
        else left(btrim(p_name) || ' - ' || coalesce(nullif(design_entry ->> 'label', ''), design_key), 180)
      end,
      nullif(btrim(coalesce(reconstruction ->> 'description', '')), ''),
      colours[1],
      colours[2],
      colours,
      (design_entry ->> 'durationSeconds')::numeric,
      jsonb_build_object(
        'schemaVersion', candidate_row.schema_version,
        'importJobId', p_job_id,
        'importRunId', candidate_row.import_run_id,
        'importCandidateId', candidate_row.id,
        'designKey', design_key,
        'template', design_entry ->> 'template'
      ),
      'video_inferred',
      greatest(0, least(1, candidate_row.score)),
      design_entry -> 'design',
      1
    )
    returning id into new_firework_id;
    design_ids := jsonb_set(design_ids, array[design_key], to_jsonb(new_firework_id::text), true);
    generated_firework_ids := array_append(generated_firework_ids, new_firework_id);
  end loop;

  if shot_count = 1 then
    shot_entry := reconstruction -> 'shots' -> 0;
    new_firework_id := (design_ids ->> (shot_entry ->> 'designKey'))::uuid;
    -- Shows read the launch aim of a single imported shot from this sealed contract.
    update public.fireworks
    set variant_json = variant_json || jsonb_build_object(
      'reconstructionShot', jsonb_build_object(
        'panDegrees', (shot_entry ->> 'panDegrees')::integer,
        'tiltDegrees', 0,
        'launchPositionIndex', 0
      )
    )
    where id = new_firework_id;

    select item.id into generated_catalogue_item_id
    from public.catalogue_items item
    where item.firework_id = new_firework_id
    for update;
    if generated_catalogue_item_id is null then
      raise exception 'The firework catalogue item was not created.' using errcode = 'P0001';
    end if;
    update public.catalogue_items
    set part_number = btrim(p_part_number),
        name = btrim(p_name),
        manufacturer = nullif(btrim(coalesce(p_manufacturer, '')), ''),
        description = nullif(btrim(coalesce(reconstruction ->> 'description', '')), ''),
        firework_type = coalesce(nullif(btrim(coalesce(p_firework_type, '')), ''), 'Video reconstructed'),
        duration_seconds = (
          select firework.duration_seconds from public.fireworks firework where firework.id = new_firework_id
        ),
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'category', nullif(btrim(coalesce(p_category, '')), ''),
          'source', 'video_import',
          'importJobId', p_job_id,
          'importRunId', candidate_row.import_run_id,
          'importCandidateId', candidate_row.id,
          'reconstructionScore', candidate_row.score
        )
    where id = generated_catalogue_item_id;
  else
    update public.catalogue_items item
    set is_listed = false,
        metadata = coalesce(item.metadata, '{}'::jsonb) || jsonb_build_object(
          'source', 'video_import_component',
          'importJobId', p_job_id,
          'importRunId', candidate_row.import_run_id,
          'importCandidateId', candidate_row.id
        )
    where item.firework_id = any(generated_firework_ids);

    insert into public.multishots (slug, name, description, duration_seconds, shot_count, metadata)
    values (
      'import-' || left(replace(p_job_id::text, '-', ''), 12),
      btrim(p_name),
      nullif(btrim(coalesce(reconstruction ->> 'description', '')), ''),
      (reconstruction ->> 'durationSeconds')::numeric,
      0,
      jsonb_build_object(
        'source', 'video_import',
        'importJobId', p_job_id,
        'importRunId', candidate_row.import_run_id,
        'importCandidateId', candidate_row.id,
        'reconstructionScore', candidate_row.score
      )
    )
    returning id into generated_multishot_id;

    for shot_entry in select value from jsonb_array_elements(reconstruction -> 'shots') loop
      shot_index := shot_index + 1;
      insert into public.multishot_fireworks (
        multishot_id, firework_id, sequence_index, time_offset_seconds, pan_degrees, tilt_degrees,
        position_override_json, notes
      ) values (
        generated_multishot_id,
        (design_ids ->> (shot_entry ->> 'designKey'))::uuid,
        shot_index,
        (shot_entry ->> 'timeOffsetSeconds')::numeric,
        (shot_entry ->> 'panDegrees')::integer,
        0,
        jsonb_build_object(
          'reconstructionShotId', coalesce(shot_entry ->> 'id', shot_index::text)
        ),
        'Video reconstruction shot ' || shot_index
      );
    end loop;

    update public.multishots set shot_count = shot_index where id = generated_multishot_id;

    select item.id into generated_catalogue_item_id
    from public.catalogue_items item
    where item.multishot_id = generated_multishot_id
    for update;
    if generated_catalogue_item_id is null then
      raise exception 'The multishot catalogue item was not created.' using errcode = 'P0001';
    end if;
    update public.catalogue_items
    set part_number = btrim(p_part_number),
        name = btrim(p_name),
        manufacturer = nullif(btrim(coalesce(p_manufacturer, '')), ''),
        description = nullif(btrim(coalesce(reconstruction ->> 'description', '')), ''),
        firework_type = coalesce(
          nullif(btrim(coalesce(p_firework_type, '')), ''),
          'Video reconstructed multishot'
        ),
        metadata = metadata || jsonb_build_object(
          'category', nullif(btrim(coalesce(p_category, '')), ''),
          'source', 'video_import',
          'importJobId', p_job_id,
          'importRunId', candidate_row.import_run_id,
          'importCandidateId', candidate_row.id,
          'reconstructionScore', candidate_row.score
        )
    where id = generated_catalogue_item_id;
  end if;

  update public.import_candidates set approved_at = now() where id = candidate_row.id;
  update public.import_jobs
  set status = 'complete',
      processing_progress = 100,
      approved_catalogue_item_id = generated_catalogue_item_id,
      approved_run_id = candidate_row.import_run_id,
      approved_candidate_id = candidate_row.id,
      approval_request_hash = computed_approval_request_hash,
      approved_by = auth.uid(),
      approved_at = now(),
      completed_at = now(),
      error_message = null
  where id = p_job_id;

  catalogue_item_id := generated_catalogue_item_id;
  firework_ids := generated_firework_ids;
  multishot_id := generated_multishot_id;
  return next;
end;
$$;

-- The stored video prompt from before renderer fitting describes the retired
-- spec format. Replace it only where an administrator has not rewritten it.
update public.prompt_configs
set system_prompt_text = 'Prefer the closest catalogue template for each shot, keep measured colours, and describe anything uncertain in notes.',
    description = 'Admin guidance appended to the firework import worker''s fixed instructions when it matches measured shots to renderer templates.',
    updated_at = now()
where key = 'firework_video_reconstruction'
  and system_prompt_text like '%FireworkEffectSpecV3%';

commit;
