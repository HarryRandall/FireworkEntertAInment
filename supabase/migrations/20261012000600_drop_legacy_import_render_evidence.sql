-- Removes the old-engine browser render evidence now that imports are validated by
-- the worker's headless renderer fit. The render seals, their retained review
-- artefact paths and the candidate column the worker no longer fills are dropped.
begin;

CREATE OR REPLACE FUNCTION "public"."complete_firework_import_run"("p_run_id" "uuid", "p_lease_token" "uuid", "p_candidates" "jsonb", "p_selected_ordinal" integer) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  run_job_id uuid;
  run_row public.import_runs;
  request_hash text;
  candidate_entry jsonb;
  chosen_candidate_id uuid;
  candidate_id uuid;
  candidate_ordinal integer;
  computed_candidate_hash text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only the import worker can complete reconstruction runs.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_candidates) is distinct from 'array'
    or jsonb_array_length(p_candidates) not between 1 and 12 then
    raise exception 'At least one reconstruction candidate is required.' using errcode = '22023';
  end if;

  request_hash := private.firework_import_sha256(
    jsonb_build_object(
      'candidates', p_candidates,
      'selectedOrdinal', p_selected_ordinal
    )::text
  );

  select job.id into run_job_id
  from public.import_jobs job
  join public.import_runs run on run.import_job_id = job.id
  where run.id = p_run_id
    and job.active_run_id = run.id
    and job.archived_at is null
  for update of job;
  if run_job_id is null then
    raise exception 'The reconstruction lease is stale.' using errcode = '55000';
  end if;

  select run.* into run_row
  from public.import_runs run
  where run.id = p_run_id
  for update;
  if not found then
    raise exception 'The reconstruction lease is stale.' using errcode = '55000';
  end if;

  if run_row.status = 'succeeded' then
    if run_row.completion_lease_token is distinct from p_lease_token
      or run_row.completion_request_hash is distinct from request_hash then
      raise exception 'This run was already completed with a different response.' using errcode = '55000';
    end if;
    select candidate.id into chosen_candidate_id
    from public.import_candidates candidate
    where candidate.import_run_id = p_run_id
      and candidate.ordinal = p_selected_ordinal;
    if chosen_candidate_id is null then
      raise exception 'The completed run is missing its selected candidate.' using errcode = '55000';
    end if;
    return chosen_candidate_id;
  end if;

  if run_row.lease_token is distinct from p_lease_token
    or run_row.status <> 'processing'
    or run_row.lease_expires_at <= now() then
    raise exception 'The reconstruction lease is stale.' using errcode = '55000';
  end if;

  for candidate_entry in select value from jsonb_array_elements(p_candidates) loop
    candidate_ordinal := (candidate_entry ->> 'ordinal')::integer;
    if jsonb_typeof(candidate_entry -> 'reconstruction') is distinct from 'object'
      or jsonb_typeof(candidate_entry -> 'validation') is distinct from 'object'
      or (candidate_entry ->> 'score')::numeric not between 0 and 1
      or coalesce(candidate_entry ->> 'contentHash', '') !~ '^[0-9a-f]{64}$' then
      raise exception 'A reconstruction candidate is malformed.' using errcode = '22023';
    end if;

    computed_candidate_hash := private.firework_import_sha256(
      (candidate_entry -> 'reconstruction')::text
    );

    insert into public.import_candidates (
      import_run_id,
      ordinal,
      schema_version,
      reconstruction,
      score,
      metrics,
      validation,
      content_hash,
      selected_at
    ) values (
      p_run_id,
      candidate_ordinal,
      coalesce(nullif(candidate_entry ->> 'schemaVersion', ''), 'showcrafter.firework-reconstruction.v1'),
      candidate_entry -> 'reconstruction',
      (candidate_entry ->> 'score')::numeric,
      coalesce(candidate_entry -> 'metrics', '{}'::jsonb),
      candidate_entry -> 'validation',
      computed_candidate_hash,
      case when candidate_ordinal = p_selected_ordinal then now() else null end
    )
    returning id into candidate_id;

    if candidate_ordinal = p_selected_ordinal then
      chosen_candidate_id := candidate_id;
    end if;
  end loop;

  if chosen_candidate_id is null then
    raise exception 'The selected candidate ordinal was not produced.' using errcode = '22023';
  end if;

  perform private.resolve_firework_import_credit(
    p_run_id,
    'settled',
    'Firework reconstruction completed successfully'
  );

  update public.import_runs
  set status = 'succeeded',
      stage = 'review',
      progress = 100,
      lease_token = null,
      lease_expires_at = null,
      heartbeat_at = now(),
      completed_at = now(),
      completion_request_hash = request_hash,
      completion_lease_token = p_lease_token,
      error_message = null
  where id = p_run_id;

  update public.import_jobs
  set status = 'needs_review',
      processing_progress = 100,
      selected_candidate_id = chosen_candidate_id,
      selected_by = null,
      selected_at = now(),
      completed_at = now(),
      error_message = null
  where id = run_row.import_job_id
    and active_run_id = p_run_id;

  return chosen_candidate_id;
end;
$_$;

drop table public.import_candidate_render_validations;

alter table public.import_candidates drop column rendered_video_path;

commit;
