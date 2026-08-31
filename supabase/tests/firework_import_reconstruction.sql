begin;

create function pg_temp.canonical_firework_design()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'size', 72,
    'colour', jsonb_build_object('enabled', true),
    'color', 'random',
    'liftVelocity', 28,
    'shellLife', 8,
    'pattern', 'fibonacci',
    'geometry', 'sphere',
    'trailProfile', 'spark',
    'burst', '{}'::jsonb,
    'burstTrail', '{}'::jsonb,
    'stars', jsonb_build_object(
      'outer', jsonb_build_object(
        'enabled', true,
        'count', 72,
        'color', 'random',
        'burst', '{}'::jsonb,
        'burstTrail', '{}'::jsonb
      ),
      'core', jsonb_build_object(
        'enabled', false,
        'count', 24,
        'color', 'random',
        'burst', '{}'::jsonb,
        'burstTrail', '{}'::jsonb
      )
    ),
    'launch', '{}'::jsonb
  );
$$;

create function pg_temp.engine_evidence(
  p_reconstruction jsonb,
  p_required_duration numeric,
  p_artifact_path text,
  p_artifact_sha256 text,
  p_artifact_byte_size bigint,
  p_artifact_storage_etag text
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'schemaVersion', 'showcrafter.import-render-result.v1',
    'harnessVersion', 'showcrafter.import-render-harness.v1',
    'rendererVersion', 'showcrafter.fireworks-engine.import-renderer.v1+sha256.90a37b6ccf746f598adfb0ad88efed910b2b699a063cf5cbd2b0f2f04773358f',
    'source', jsonb_build_object('durationSeconds', p_required_duration, 'width', 960, 'height', 540),
    'rendererDurations', (
      select jsonb_agg(
        jsonb_build_object(
          'designKey', design ->> 'key',
          'durationSeconds', (design ->> 'durationSeconds')::numeric
        )
        order by design ->> 'key'
      )
      from jsonb_array_elements(p_reconstruction -> 'designs') design
    ),
    'requiredProductDurationSeconds', p_required_duration,
    'reviewArtifact', jsonb_build_object(
      'storagePath', p_artifact_path,
      'sha256', p_artifact_sha256,
      'byteSize', p_artifact_byte_size,
      'storageETag', p_artifact_storage_etag
    ),
    'metrics', jsonb_build_object(
      'schemaVersion', 'showcrafter.engine-render-metrics.v2',
      'engine', jsonb_build_object(
        'renderer', 'FireworksEngine',
        'rendererVersion', 'showcrafter.fireworks-engine.import-renderer.v1+sha256.90a37b6ccf746f598adfb0ad88efed910b2b699a063cf5cbd2b0f2f04773358f',
        'camera', 'FireworkReplayCanvas.default',
        'frameCount', 32,
        'frameWidth', 960,
        'frameHeight', 540,
        'fixedStepSeconds', 1.0 / 60.0
      ),
      'timing', jsonb_build_object('score', 0.95),
      'trajectory', jsonb_build_object('score', 0.94, 'comparedFrameCount', 32),
      'palette', jsonb_build_object('score', 0.93),
      'fade', jsonb_build_object('score', 0.92, 'comparedFrameCount', 32),
      'perceptual', jsonb_build_object(
        'score', 0.91,
        'comparedFrameCount', 32,
        'activeFrameCount', 18,
        'foregroundWeightTotal', 2.4
      ),
      'overallScore', 0.93,
      'priorityIssues', '[]'::jsonb
    )
  );
$$;

create function pg_temp.single_reconstruction(
  p_name text,
  p_description text,
  p_design_key text,
  p_seed integer
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'version', 1,
    'name', p_name,
    'description', p_description,
    'durationSeconds', 4,
    'confidence', 0.9,
    'designs', jsonb_build_array(
      jsonb_build_object(
        'key', p_design_key,
        'effectSlug', 'peony',
        'design', pg_temp.canonical_firework_design(),
        'colorPalette', jsonb_build_array('#ff0000'),
        'durationSeconds', 4,
        'heightMeters', 35,
        'caliber', '30mm',
        'confidence', 0.9
      )
    ),
    'shots', jsonb_build_array(
      jsonb_build_object(
        'id', 'shot-1',
        'designKey', p_design_key,
        'timeOffsetSeconds', 0,
        'panDegrees', 0,
        'tiltDegrees', 0,
        'position', jsonb_build_object('x', 0, 'y', 0, 'z', 0),
        'seed', p_seed,
        'scale', 1
      )
    )
  );
$$;

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
set local request.jwt.claim.role = 'authenticated';

insert into public.permissions (key, name, category)
values
  ('admin.manage_imports', 'Manage imports', 'admin'),
  ('admin.manage_catalogue', 'Manage catalogue', 'admin');

insert into public.roles (key, name)
values
  ('user', 'User'),
  ('import-test-admin', 'Import test admin');

insert into auth.users (id, email, role, aud, created_at, updated_at)
values
  (
    '10000000-0000-0000-0000-000000000001',
    'import-test@example.com',
    'authenticated',
    'authenticated',
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'import-retry-test@example.com',
    'authenticated',
    'authenticated',
    now(),
    now()
  );

-- Schema-only PostgreSQL harnesses do not carry auth-owned triggers. Keep the
-- application mirror explicit so the live active-user permission check is
-- exercised in both the harness and a full Supabase stack.
insert into public.users (id, email, full_name, status)
values
  (
    '10000000-0000-0000-0000-000000000001',
    'import-test@example.com',
    'Import test admin',
    'active'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'import-retry-test@example.com',
    'Import retry test admin',
    'active'
  )
on conflict (id) do update
set email = excluded.email,
    full_name = excluded.full_name,
    status = excluded.status;

insert into public.role_permissions (role_id, permission_id)
select role.id, permission.id
from public.roles role
cross join public.permissions permission
where role.key = 'import-test-admin'
  and permission.key in ('admin.manage_imports', 'admin.manage_catalogue');

insert into public.user_roles (user_id, role_id)
select user_id, role.id
from unnest(array[
  '10000000-0000-0000-0000-000000000001'::uuid,
  '10000000-0000-0000-0000-000000000002'::uuid
]) as users(user_id)
cross join public.roles role
where role.key = 'import-test-admin'
on conflict (user_id) do update set role_id = excluded.role_id;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'import-videos',
  'import-videos',
  false,
  262144000,
  array['video/mp4']
);

insert into public.firework_effects (slug, name, pattern_key, model_json, source)
values
  ('peony', 'Peony', 'sphere', '{}'::jsonb, 'reference'),
  ('ring', 'Ring', 'ring', '{}'::jsonb, 'reference');

insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
values (
  'import-videos',
  '10000000-0000-0000-0000-000000000001/single.mp4',
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '{"mimetype":"video/mp4","size":"1024"}'::jsonb
);

create temporary table first_import as
select *
from public.finalise_firework_video_import(
  'Single reconstruction',
  '10000000-0000-0000-0000-000000000001/single.mp4',
  'single.mp4',
  'openai/gpt-5.4',
  4
);

do $$
begin
  if (select count(*) from first_import) <> 1
    or (select count(*) from public.media_assets) <> 1
    or (select count(*) from public.import_jobs) <> 1
    or (select count(*) from public.import_runs) <> 1 then
    raise exception 'Atomic upload finalisation did not create exactly one lifecycle.';
  end if;
end;
$$;

do $$
declare
  repeated_job_id uuid;
  repeated_run_id uuid;
begin
  select job_id, run_id
  into repeated_job_id, repeated_run_id
  from public.finalise_firework_video_import(
    'Single reconstruction',
    '10000000-0000-0000-0000-000000000001/single.mp4',
    'single.mp4',
    'openai/gpt-5.4',
    4
  );
  if repeated_job_id <> (select job_id from first_import)
    or repeated_run_id <> (select run_id from first_import)
    or (select count(*) from public.media_assets) <> 1 then
    raise exception 'Upload finalisation is not idempotent.';
  end if;
end;
$$;

do $$
declare
  first_run_id uuid := (select run_id from first_import);
begin
  if (select balance from public.ai_credit_accounts
      where user_id = '10000000-0000-0000-0000-000000000001') <> 150
    or (select reserved from public.ai_credit_accounts
        where user_id = '10000000-0000-0000-0000-000000000001') <> 5
    or (select credit_status from public.import_runs where id = first_run_id) <> 'reserved'
    or (select count(*) from public.ai_credit_transactions
        where reference_type = 'import_run'
          and reference_id = first_run_id
          and transaction_type = 'reserve'
          and status = 'reserved') <> 1 then
    raise exception 'Initial reconstruction credit reservation was not atomic or idempotent.';
  end if;
end;
$$;

do $$
begin
  begin
    perform public.check_firework_import_dispatch_ready();
    raise exception 'Authenticated caller unexpectedly passed dispatch preflight.';
  exception
    when sqlstate '42501' then null;
  end;
  begin
    perform public.begin_firework_import_dispatch((select run_id from first_import));
    raise exception 'Authenticated caller unexpectedly began trusted dispatch.';
  exception
    when sqlstate '42501' then null;
  end;
  begin
    perform public.record_firework_import_dispatch_result(
      (select run_id from first_import),
      'accepted',
      1,
      'direct-call-forbidden',
      null
    );
    raise exception 'Authenticated caller unexpectedly recorded trusted dispatch.';
  exception
    when sqlstate '42501' then null;
  end;
end;
$$;

set local request.jwt.claim.role = 'service_role';

do $$
begin
  if not public.check_firework_import_dispatch_ready()
    or not public.begin_firework_import_dispatch((select run_id from first_import))
    or public.begin_firework_import_dispatch((select run_id from first_import)) then
    raise exception 'Trusted direct dispatch was not claimed exactly once.';
  end if;

  begin
    perform public.record_firework_import_dispatch_result(
      (select run_id from first_import),
      'accepted',
      1,
      '',
      null
    );
    raise exception 'Empty direct dispatch call ID unexpectedly passed validation.';
  exception
    when sqlstate '22023' then null;
  end;

  if public.record_firework_import_dispatch_result(
    (select run_id from first_import),
    'accepted',
    2,
    'direct-call-first',
    null
  ) <> 'accepted' then
    raise exception 'Trusted direct dispatch acknowledgement was not recorded.';
  end if;

  if (select direct_dispatch_status from public.import_runs
      where id = (select run_id from first_import)) <> 'accepted'
    or (select direct_dispatch_call_id from public.import_runs
        where id = (select run_id from first_import)) <> 'direct-call-first'
    or (select direct_dispatch_attempt_count from public.import_runs
        where id = (select run_id from first_import)) <> 2
    or (select modal_call_id from public.import_runs
        where id = (select run_id from first_import)) is not null then
    raise exception 'Direct dispatch provenance was not stored separately from executor provenance.';
  end if;
end;
$$;

create temporary table first_claim as
select *
from public.claim_firework_import_run(
  'firework-reconstruction-test',
  (select run_id from first_import),
  900
);

select public.record_firework_import_run_context(
  (select run_id from first_claim),
  (select lease_token from first_claim),
  repeat('1', 64),
  'firework-reconstruction-test',
  'showcrafter.firework-design.v1',
  'openai/gpt-5.4',
  '{}'::jsonb,
  '{}'::jsonb,
  'executor-call-first'
);

do $$
begin
  if (select direct_dispatch_status from public.import_runs
      where id = (select run_id from first_claim)) <> 'accepted'
    or (select direct_dispatch_call_id from public.import_runs
        where id = (select run_id from first_claim)) <> 'direct-call-first'
    or (select modal_call_id from public.import_runs
        where id = (select run_id from first_claim)) <> 'executor-call-first' then
    raise exception 'Worker claim conflated direct and executor call provenance.';
  end if;
end;
$$;

select public.heartbeat_firework_import_run(
  (select run_id from first_claim),
  (select lease_token from first_claim),
  'validate',
  80,
  900
);

select public.append_firework_import_run_output(
  (select run_id from first_claim),
  (select lease_token from first_claim),
  'observations',
  0,
  'frame_observations',
  'showcrafter.observations.v1',
  '{"bursts":1}'::jsonb,
  repeat('a', 64),
  null
);

create temporary table first_completion_payload as
select jsonb_build_array(
    jsonb_build_object(
      'ordinal', 0,
      'schemaVersion', 'showcrafter.firework-reconstruction.v1',
      'reconstruction', jsonb_build_object(
        'version', 1,
        'name', 'Single reconstruction',
        'description', 'One red peony.',
        'durationSeconds', 4,
        'confidence', 0.9,
        'designs', jsonb_build_array(
          jsonb_build_object(
            'key', 'red-peony',
            'effectSlug', 'peony',
            'design', pg_temp.canonical_firework_design(),
            'colorPalette', jsonb_build_array('#ff0000'),
            'durationSeconds', 4,
            'heightMeters', 35,
            'caliber', '30mm',
            'confidence', 0.9
          )
        ),
        'shots', jsonb_build_array(
          jsonb_build_object(
            'id', 'shot-1',
            'designKey', 'red-peony',
            'timeOffsetSeconds', 0,
            'panDegrees', 0,
            'tiltDegrees', 0,
            'position', jsonb_build_object('x', 0, 'y', 0, 'z', 0),
            'seed', 101,
            'scale', 1
          )
        )
      ),
      'score', 0.9,
      'metrics', jsonb_build_object('timing', 0.95),
      'validation', jsonb_build_object('valid', true, 'blockers', jsonb_build_array()),
      'contentHash', repeat('b', 64)
    )
  ) as candidates;

update first_completion_payload
set candidates = jsonb_set(
  jsonb_set(
    candidates,
    '{0,metrics}',
    jsonb_build_object(
      'engineRender',
      pg_temp.engine_evidence(
        candidates -> 0 -> 'reconstruction',
        4,
        '10000000-0000-0000-0000-000000000001/engine-review-'
          || (select run_id from first_import)::text
          || '-1111111111111111.mp4',
        repeat('a', 64),
        4096,
        repeat('1', 32)
      )
    )
  ),
  '{0,renderedVideoPath}',
  to_jsonb(
    '10000000-0000-0000-0000-000000000001/engine-review-'
      || (select run_id from first_import)::text
      || '-1111111111111111.mp4'
  )
);

insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
select
  'import-videos',
  candidates -> 0 ->> 'renderedVideoPath',
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  jsonb_build_object(
    'mimetype', 'video/mp4',
    'size', '4096',
    'eTag', repeat('1', 32)
  )
from first_completion_payload;

select public.append_firework_import_run_output(
  (select run_id from first_claim),
  (select lease_token from first_claim),
  'engine_validation',
  1,
  'render_metrics',
  'showcrafter.import-render-result.v1',
  (select candidates -> 0 -> 'metrics' -> 'engineRender' from first_completion_payload),
  repeat('f', 64),
  (select candidates -> 0 ->> 'renderedVideoPath' from first_completion_payload)
);

create temporary table first_candidate as
select public.complete_firework_import_run(
  (select run_id from first_claim),
  (select lease_token from first_claim),
  (select candidates from first_completion_payload),
  0
) as candidate_id;

create temporary table replayed_completion as
select public.complete_firework_import_run(
  (select run_id from first_claim),
  (select lease_token from first_claim),
  (select candidates from first_completion_payload),
  0
) as candidate_id;

do $$
begin
  if (select candidate_id from replayed_completion)
      <> (select candidate_id from first_candidate) then
    raise exception 'Exact completion replay did not return the original candidate.';
  end if;
end;
$$;

do $$
declare
  first_run_id uuid := (select run_id from first_import);
begin
  if (select balance from public.ai_credit_accounts
      where user_id = '10000000-0000-0000-0000-000000000001') <> 145
    or (select reserved from public.ai_credit_accounts
        where user_id = '10000000-0000-0000-0000-000000000001') <> 0
    or (select credit_status from public.import_runs where id = first_run_id) <> 'settled'
    or (select count(*) from public.ai_credit_transactions
        where reference_type = 'import_run'
          and reference_id = first_run_id
          and transaction_type = 'reserve'
          and status = 'settled') <> 1
    or (select count(*) from public.ai_credit_transactions
        where reference_type = 'import_run'
          and reference_id = first_run_id
          and transaction_type = 'debit'
          and status = 'applied') <> 1
    or exists (
      select 1
      from public.ai_credit_transactions
      where reference_type = 'import_run'
        and reference_id = first_run_id
        and transaction_type = 'refund'
    ) then
    raise exception 'Completion replay duplicated or mis-settled reconstruction credits.';
  end if;
end;
$$;

set local request.jwt.claim.role = 'authenticated';

do $$
begin
  begin
    perform public.approve_firework_import_candidate(
      (select job_id from first_import),
      (select candidate_id from first_candidate),
      'UNSEALED-IMPORT',
      'Unsealed reconstruction'
    );
    raise exception 'Unsealed candidate approval unexpectedly succeeded.';
  exception
    when sqlstate '55000' then null;
  end;
  if exists (select 1 from public.fireworks) then
    raise exception 'Unsealed candidate approval left partial catalogue data.';
  end if;
end;
$$;

set local request.jwt.claim.role = 'service_role';

do $$
begin
  begin
    perform public.seal_firework_import_candidate(
      (select candidate_id from first_candidate),
      'showcrafter.firework-design.v1',
      (
        jsonb_set(
          (
            select reconstruction
            from public.import_candidates
            where id = (select candidate_id from first_candidate)
          ),
          '{designs,0,design}',
          pg_temp.canonical_firework_design()
        ) - 'version'
      ),
      (
        select content_hash
        from public.import_candidates
        where id = (select candidate_id from first_candidate)
      )
    );
    raise exception 'Canonical reconstruction without a schema version unexpectedly sealed.';
  exception
    when sqlstate '22023' then null;
  end;

  if exists (
    select 1
    from public.import_candidate_validations
    where candidate_id = (select candidate_id from first_candidate)
  ) then
    raise exception 'Rejected canonical reconstruction left a validation seal.';
  end if;
end;
$$;

select public.seal_firework_import_candidate(
  (select candidate_id from first_candidate),
  'showcrafter.firework-design.v1',
  jsonb_set(
    (select reconstruction from public.import_candidates where id = (select candidate_id from first_candidate)),
    '{designs,0,design}',
    pg_temp.canonical_firework_design()
  ),
  (select content_hash from public.import_candidates where id = (select candidate_id from first_candidate))
);

select public.seal_firework_import_render_validation(
  (select candidate_id from first_candidate),
  'showcrafter.engine-render-publication.v1',
  (select candidates -> 0 -> 'metrics' -> 'engineRender' from first_completion_payload),
  (select candidates -> 0 ->> 'renderedVideoPath' from first_completion_payload)
);

select public.seal_firework_import_render_validation(
  (select candidate_id from first_candidate),
  'showcrafter.engine-render-publication.v1',
  (select candidates -> 0 -> 'metrics' -> 'engineRender' from first_completion_payload),
  (select candidates -> 0 ->> 'renderedVideoPath' from first_completion_payload)
);

do $$
begin
  if (select count(*) from public.import_candidate_render_validations
      where candidate_id = (select candidate_id from first_candidate)) <> 1
    or (select artifact_sha256 from public.import_candidate_render_validations
        where candidate_id = (select candidate_id from first_candidate)) <> repeat('a', 64)
    or (select artifact_byte_size from public.import_candidate_render_validations
        where candidate_id = (select candidate_id from first_candidate)) <> 4096
    or (select artifact_storage_etag from public.import_candidate_render_validations
        where candidate_id = (select candidate_id from first_candidate)) <> repeat('1', 32) then
    raise exception 'Exact engine artefact replay changed or lost its immutable seal.';
  end if;
end;
$$;

update storage.objects
set metadata = jsonb_set(metadata, '{eTag}', to_jsonb(repeat('9', 32)))
where bucket_id = 'import-videos'
  and name = (select candidates -> 0 ->> 'renderedVideoPath' from first_completion_payload);

do $$
begin
  begin
    perform public.seal_firework_import_render_validation(
      (select candidate_id from first_candidate),
      'showcrafter.engine-render-publication.v1',
      (select candidates -> 0 -> 'metrics' -> 'engineRender' from first_completion_payload),
      (select candidates -> 0 ->> 'renderedVideoPath' from first_completion_payload)
    );
    raise exception 'An overwritten engine review artefact unexpectedly replayed its seal.';
  exception
    when sqlstate '55000' then null;
  end;
end;
$$;

update storage.objects
set metadata = jsonb_set(metadata, '{eTag}', to_jsonb(repeat('1', 32)))
where bucket_id = 'import-videos'
  and name = (select candidates -> 0 ->> 'renderedVideoPath' from first_completion_payload);

set local request.jwt.claim.role = 'authenticated';

create temporary table reviewed_candidate as
select public.select_firework_import_candidate(
  (select job_id from first_import),
  (select candidate_id from first_candidate)
) as candidate_id;

do $$
begin
  if (select selected_candidate_id from public.import_jobs where id = (select job_id from first_import))
      <> (select candidate_id from reviewed_candidate) then
    raise exception 'Candidate selection was not persisted.';
  end if;
end;
$$;

update storage.objects
set metadata = jsonb_set(metadata, '{size}', to_jsonb('4097'::text))
where bucket_id = 'import-videos'
  and name = (select candidates -> 0 ->> 'renderedVideoPath' from first_completion_payload);

do $$
begin
  begin
    perform public.approve_firework_import_candidate(
      (select job_id from first_import),
      (select candidate_id from first_candidate),
      'IMPORT-SINGLE-1',
      'Single reconstruction',
      'ShowCrafter test',
      'Aerial',
      'Single shot'
    );
    raise exception 'Approval unexpectedly accepted an overwritten retained artefact.';
  exception
    when sqlstate '55000' then null;
  end;
  if exists (select 1 from public.fireworks) then
    raise exception 'Rejected artefact mismatch left partial catalogue data.';
  end if;
end;
$$;

update storage.objects
set metadata = jsonb_set(metadata, '{size}', to_jsonb('4096'::text))
where bucket_id = 'import-videos'
  and name = (select candidates -> 0 ->> 'renderedVideoPath' from first_completion_payload);

create temporary table first_approval as
select *
from public.approve_firework_import_candidate(
  (select job_id from first_import),
  (select candidate_id from first_candidate),
  'IMPORT-SINGLE-1',
  'Single reconstruction',
  'ShowCrafter test',
  'Aerial',
  'Single shot'
);

do $$
declare
  repeated_catalogue_id uuid;
  expected_approval_hash text;
  expected_approved_at timestamptz;
  expected_evidence_hash text;
  expected_artifact_output_id uuid;
  expected_artifact_sha256 text;
  expected_artifact_byte_size bigint;
  expected_artifact_storage_etag text;
  expected_ledger_rows bigint;
begin
  select job.approval_request_hash, job.approved_at
  into expected_approval_hash, expected_approved_at
  from public.import_jobs job
  where job.id = (select job_id from first_import);

  select
    validation.evidence_hash,
    validation.artifact_output_id,
    validation.artifact_sha256,
    validation.artifact_byte_size,
    validation.artifact_storage_etag
  into
    expected_evidence_hash,
    expected_artifact_output_id,
    expected_artifact_sha256,
    expected_artifact_byte_size,
    expected_artifact_storage_etag
  from public.import_candidate_render_validations validation
  where validation.candidate_id = (select candidate_id from first_candidate);

  select count(*) into expected_ledger_rows
  from public.ai_credit_transactions
  where reference_type = 'import_run'
    and reference_id = (select run_id from first_import);

  select catalogue_item_id into repeated_catalogue_id
  from public.approve_firework_import_candidate(
    (select job_id from first_import),
    (select candidate_id from first_candidate),
    'IMPORT-SINGLE-1',
    'Single reconstruction',
    'ShowCrafter test',
    'Aerial',
    'Single shot'
  );
  if repeated_catalogue_id <> (select catalogue_item_id from first_approval)
    or (select count(*) from public.fireworks) <> 1
    or (select count(*) from public.catalogue_items) <> 1
    or (select duration_seconds from public.catalogue_items where id = repeated_catalogue_id) <> 4
    or (select caliber from public.fireworks limit 1) <> '30mm'
    or (select variant_json -> 'reconstructionShot' ->> 'seedOverride' from public.fireworks limit 1) <> '101'
    or (select approval_request_hash from public.import_jobs
        where id = (select job_id from first_import)) is distinct from expected_approval_hash
    or (select approved_at from public.import_jobs
        where id = (select job_id from first_import)) is distinct from expected_approved_at
    or (select evidence_hash from public.import_candidate_render_validations
        where candidate_id = (select candidate_id from first_candidate))
      is distinct from expected_evidence_hash
    or (select artifact_output_id from public.import_candidate_render_validations
        where candidate_id = (select candidate_id from first_candidate))
      is distinct from expected_artifact_output_id
    or (select artifact_sha256 from public.import_candidate_render_validations
        where candidate_id = (select candidate_id from first_candidate))
      is distinct from expected_artifact_sha256
    or (select artifact_byte_size from public.import_candidate_render_validations
        where candidate_id = (select candidate_id from first_candidate))
      is distinct from expected_artifact_byte_size
    or (select artifact_storage_etag from public.import_candidate_render_validations
        where candidate_id = (select candidate_id from first_candidate))
      is distinct from expected_artifact_storage_etag
    or (select count(*) from public.import_candidate_render_validations
        where candidate_id = (select candidate_id from first_candidate)) <> 1
    or (select count(*) from public.ai_credit_transactions
        where reference_type = 'import_run'
          and reference_id = (select run_id from first_import)) <> expected_ledger_rows then
    raise exception 'Single-shot approval changed catalogue, engine evidence or credits on replay.';
  end if;
end;
$$;

update storage.objects
set metadata = jsonb_set(metadata, '{eTag}', to_jsonb(repeat('7', 32)))
where bucket_id = 'import-videos'
  and name = (select candidates -> 0 ->> 'renderedVideoPath' from first_completion_payload);

do $$
begin
  begin
    perform public.approve_firework_import_candidate(
      (select job_id from first_import),
      (select candidate_id from first_candidate),
      'IMPORT-SINGLE-1',
      'Single reconstruction',
      'ShowCrafter test',
      'Aerial',
      'Single shot'
    );
    raise exception 'Approved replay unexpectedly accepted a later artefact overwrite.';
  exception
    when sqlstate '55000' then null;
  end;
end;
$$;

update storage.objects
set metadata = jsonb_set(metadata, '{eTag}', to_jsonb(repeat('1', 32)))
where bucket_id = 'import-videos'
  and name = (select candidates -> 0 ->> 'renderedVideoPath' from first_completion_payload);

do $$
declare
  expected_approval_hash text := (
    select approval_request_hash
    from public.import_jobs
    where id = (select job_id from first_import)
  );
begin
  begin
    perform public.approve_firework_import_candidate(
      (select job_id from first_import),
      (select candidate_id from first_candidate),
      'IMPORT-SINGLE-1',
      'Changed replay metadata',
      'ShowCrafter test',
      'Aerial',
      'Single shot'
    );
    raise exception 'Approval replay with changed metadata unexpectedly succeeded.';
  exception
    when sqlstate '55000' then null;
  end;

  if (select approval_request_hash from public.import_jobs
      where id = (select job_id from first_import)) is distinct from expected_approval_hash
    or (select count(*) from public.catalogue_items) <> 1
    or (select count(*) from public.fireworks) <> 1 then
    raise exception 'Rejected approval replay changed persisted approval evidence.';
  end if;
end;
$$;

create temporary table cross_credit_before as
select account.balance, account.reserved
from public.ai_credit_accounts account
where account.user_id = '10000000-0000-0000-0000-000000000001';

insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
values (
  'import-videos',
  '10000000-0000-0000-0000-000000000001/cross-admin.mp4',
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '{"mimetype":"video/mp4","size":"2048"}'::jsonb
);

create temporary table cross_initial_import as
select *
from public.finalise_firework_video_import(
  'Cross-admin reconstruction',
  '10000000-0000-0000-0000-000000000001/cross-admin.mp4',
  'cross-admin.mp4',
  'openai/gpt-5.4',
  4
);

do $$
declare
  cross_run_id uuid := (select run_id from cross_initial_import);
begin
  if (select balance from public.ai_credit_accounts
      where user_id = '10000000-0000-0000-0000-000000000001')
      <> (select balance from cross_credit_before)
    or (select reserved from public.ai_credit_accounts
        where user_id = '10000000-0000-0000-0000-000000000001')
      <> (select reserved + 5 from cross_credit_before)
    or (select credit_status from public.import_runs where id = cross_run_id) <> 'reserved'
    or (select count(*) from public.ai_credit_transactions
        where reference_type = 'import_run'
          and reference_id = cross_run_id
          and transaction_type = 'reserve'
          and status = 'reserved') <> 1 then
    raise exception 'Cross-admin source run did not reserve exactly one reconstruction charge.';
  end if;
end;
$$;

set local request.jwt.claim.role = 'service_role';

create temporary table cross_failed_claim as
select *
from public.claim_firework_import_run(
  'firework-reconstruction-test',
  (select run_id from cross_initial_import),
  900
);

select public.fail_firework_import_run(
  (select run_id from cross_failed_claim),
  (select lease_token from cross_failed_claim),
  'Synthetic worker failure before retry'
);

select public.fail_firework_import_run(
  (select run_id from cross_failed_claim),
  (select lease_token from cross_failed_claim),
  'Synthetic worker failure before retry'
);

do $$
declare
  cross_run_id uuid := (select run_id from cross_initial_import);
begin
  begin
    perform public.fail_firework_import_run(
      (select run_id from cross_failed_claim),
      (select lease_token from cross_failed_claim),
      'A different failure response'
    );
    raise exception 'Failure replay with changed evidence unexpectedly succeeded.';
  exception
    when sqlstate '55000' then null;
  end;

  if (select balance from public.ai_credit_accounts
      where user_id = '10000000-0000-0000-0000-000000000001')
      <> (select balance from cross_credit_before)
    or (select reserved from public.ai_credit_accounts
        where user_id = '10000000-0000-0000-0000-000000000001')
      <> (select reserved from cross_credit_before)
    or (select credit_status from public.import_runs where id = cross_run_id) <> 'refunded'
    or (select count(*) from public.ai_credit_transactions
        where reference_type = 'import_run'
          and reference_id = cross_run_id
          and transaction_type = 'reserve'
          and status = 'refunded') <> 1
    or (select count(*) from public.ai_credit_transactions
        where reference_type = 'import_run'
          and reference_id = cross_run_id
          and transaction_type = 'refund'
          and status = 'applied') <> 1
    or exists (
      select 1
      from public.ai_credit_transactions
      where reference_type = 'import_run'
        and reference_id = cross_run_id
        and transaction_type = 'debit'
    ) then
    raise exception 'Failure replay duplicated or mis-refunded reconstruction credits.';
  end if;
end;
$$;

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';
set local request.jwt.claim.role = 'authenticated';

create temporary table cross_retry as
select *
from public.start_firework_import_run(
  (select job_id from cross_initial_import),
  'retry',
  'openai/gpt-5.4',
  'cross-admin-retry-00000001',
  null
);

do $$
begin
  if (select created_by from cross_retry)
      <> '10000000-0000-0000-0000-000000000002'::uuid
    or (select parent_run_id from cross_retry)
      <> (select run_id from cross_initial_import)
    or (select balance from public.ai_credit_accounts
        where user_id = '10000000-0000-0000-0000-000000000002') <> 150
    or (select reserved from public.ai_credit_accounts
        where user_id = '10000000-0000-0000-0000-000000000002') <> 5
    or (select credit_status from cross_retry) <> 'reserved' then
    raise exception 'Cross-admin retry did not preserve provenance or reserve its own credits.';
  end if;
end;
$$;

set local request.jwt.claim.role = 'service_role';

create temporary table cross_retry_claim as
select *
from public.claim_firework_import_run(
  'firework-reconstruction-test',
  (select id from cross_retry),
  900
);

create temporary table cross_completion_payload as
with reconstructions as (
  select
    pg_temp.single_reconstruction(
      'Cross-admin valid reconstruction',
      'A valid retry reconstructed by another administrator.',
      'cross-valid',
      301
    ) as valid,
    pg_temp.single_reconstruction(
      'Cross-admin stale renderer',
      'A candidate captured with a stale renderer contract.',
      'cross-stale',
      302
    ) as stale,
    pg_temp.single_reconstruction(
      'Cross-admin weak fade',
      'A candidate whose fade component misses the publication gate.',
      'cross-weak',
      303
    ) as weak,
    pg_temp.single_reconstruction(
      'Cross-admin missing renderer contract',
      'A candidate whose evidence omits the renderer contract.',
      'cross-missing-contract',
      304
    ) as missing_contract,
    pg_temp.single_reconstruction(
      'Cross-admin missing renderer durations',
      'A candidate whose evidence omits renderer duration provenance.',
      'cross-missing-durations',
      305
    ) as missing_durations
), evidence as (
  select
    valid,
    stale,
    weak,
    missing_contract,
    missing_durations,
    pg_temp.engine_evidence(
      valid,
      4,
      '10000000-0000-0000-0000-000000000001/engine-review-'
        || (select id from cross_retry)::text
        || '-3333333333333333.mp4',
      repeat('d', 64),
      4096,
      repeat('3', 32)
    ) as valid_evidence,
    jsonb_set(
      pg_temp.engine_evidence(
        stale,
        4,
        '10000000-0000-0000-0000-000000000001/engine-review-'
          || (select id from cross_retry)::text
          || '-4444444444444444.mp4',
        repeat('e', 64),
        4096,
        repeat('4', 32)
      ),
      '{rendererVersion}',
      to_jsonb('showcrafter.fireworks-engine.import-renderer.v0'::text)
    ) as stale_evidence,
    jsonb_set(
      pg_temp.engine_evidence(
        weak,
        4,
        '10000000-0000-0000-0000-000000000001/engine-review-'
          || (select id from cross_retry)::text
          || '-5555555555555555.mp4',
        repeat('f', 64),
        4096,
        repeat('5', 32)
      ),
      '{metrics,fade,score}',
      to_jsonb(0.77::numeric)
    ) as weak_evidence,
    pg_temp.engine_evidence(
      missing_contract,
      4,
      '10000000-0000-0000-0000-000000000001/engine-review-'
        || (select id from cross_retry)::text
        || '-6666666666666666.mp4',
      repeat('6', 64),
      4096,
      repeat('6', 32)
    ) - 'rendererVersion' as missing_contract_evidence,
    pg_temp.engine_evidence(
      missing_durations,
      4,
      '10000000-0000-0000-0000-000000000001/engine-review-'
        || (select id from cross_retry)::text
        || '-7777777777777777.mp4',
      repeat('7', 64),
      4096,
      repeat('7', 32)
    ) - 'rendererDurations' as missing_durations_evidence
  from reconstructions
)
select jsonb_build_array(
  jsonb_build_object(
    'ordinal', 0,
    'schemaVersion', 'showcrafter.firework-reconstruction.v1',
    'reconstruction', valid,
    'score', 0.93,
    'metrics', jsonb_build_object('engineRender', valid_evidence),
    'validation', jsonb_build_object('valid', true, 'blockers', jsonb_build_array()),
    'contentHash', repeat('d', 64),
    'renderedVideoPath',
      '10000000-0000-0000-0000-000000000001/engine-review-'
        || (select id from cross_retry)::text
        || '-3333333333333333.mp4'
  ),
  jsonb_build_object(
    'ordinal', 1,
    'schemaVersion', 'showcrafter.firework-reconstruction.v1',
    'reconstruction', stale,
    'score', 0.92,
    'metrics', jsonb_build_object('engineRender', stale_evidence),
    'validation', jsonb_build_object('valid', true, 'blockers', jsonb_build_array()),
    'contentHash', repeat('e', 64),
    'renderedVideoPath',
      '10000000-0000-0000-0000-000000000001/engine-review-'
        || (select id from cross_retry)::text
        || '-4444444444444444.mp4'
  ),
  jsonb_build_object(
    'ordinal', 2,
    'schemaVersion', 'showcrafter.firework-reconstruction.v1',
    'reconstruction', weak,
    'score', 0.91,
    'metrics', jsonb_build_object('engineRender', weak_evidence),
    'validation', jsonb_build_object('valid', true, 'blockers', jsonb_build_array()),
    'contentHash', repeat('f', 64),
    'renderedVideoPath',
      '10000000-0000-0000-0000-000000000001/engine-review-'
        || (select id from cross_retry)::text
        || '-5555555555555555.mp4'
  ),
  jsonb_build_object(
    'ordinal', 3,
    'schemaVersion', 'showcrafter.firework-reconstruction.v1',
    'reconstruction', missing_contract,
    'score', 0.9,
    'metrics', jsonb_build_object('engineRender', missing_contract_evidence),
    'validation', jsonb_build_object('valid', true, 'blockers', jsonb_build_array()),
    'contentHash', repeat('6', 64),
    'renderedVideoPath',
      '10000000-0000-0000-0000-000000000001/engine-review-'
        || (select id from cross_retry)::text
        || '-6666666666666666.mp4'
  ),
  jsonb_build_object(
    'ordinal', 4,
    'schemaVersion', 'showcrafter.firework-reconstruction.v1',
    'reconstruction', missing_durations,
    'score', 0.89,
    'metrics', jsonb_build_object('engineRender', missing_durations_evidence),
    'validation', jsonb_build_object('valid', true, 'blockers', jsonb_build_array()),
    'contentHash', repeat('7', 64),
    'renderedVideoPath',
      '10000000-0000-0000-0000-000000000001/engine-review-'
        || (select id from cross_retry)::text
        || '-7777777777777777.mp4'
  )
) as candidates
from evidence;

insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
select
  'import-videos',
  candidates -> 0 ->> 'renderedVideoPath',
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  jsonb_build_object(
    'mimetype', 'video/mp4',
    'size', '4096',
    'eTag', repeat('3', 32)
  )
from cross_completion_payload;

select public.append_firework_import_run_output(
  (select run_id from cross_retry_claim),
  (select lease_token from cross_retry_claim),
  'engine_validation',
  0,
  'render_metrics',
  'showcrafter.import-render-result.v1',
  (select candidates -> 0 -> 'metrics' -> 'engineRender' from cross_completion_payload),
  repeat('2', 64),
  (select candidates -> 0 ->> 'renderedVideoPath' from cross_completion_payload)
);

create temporary table cross_selected_candidate as
select public.complete_firework_import_run(
  (select run_id from cross_retry_claim),
  (select lease_token from cross_retry_claim),
  (select candidates from cross_completion_payload),
  0
) as candidate_id;

select public.seal_firework_import_candidate(
  candidate.id,
  'showcrafter.firework-design.v1',
  candidate.reconstruction,
  candidate.content_hash
)
from public.import_candidates candidate
where candidate.import_run_id = (select id from cross_retry)
order by candidate.ordinal;

do $$
begin
  begin
    perform public.seal_firework_import_render_validation(
      (
        select candidate.id
        from public.import_candidates candidate
        where candidate.import_run_id = (select id from cross_retry)
          and candidate.ordinal = 1
      ),
      'showcrafter.engine-render-publication.v1',
      (
        select candidate.metrics -> 'engineRender'
        from public.import_candidates candidate
        where candidate.import_run_id = (select id from cross_retry)
          and candidate.ordinal = 1
      ),
      (
        select candidate.rendered_video_path
        from public.import_candidates candidate
        where candidate.import_run_id = (select id from cross_retry)
          and candidate.ordinal = 1
      )
    );
    raise exception 'Stale renderer contract unexpectedly passed publication sealing.';
  exception
    when sqlstate '22023' then null;
  end;

  begin
    perform public.seal_firework_import_render_validation(
      (
        select candidate.id
        from public.import_candidates candidate
        where candidate.import_run_id = (select id from cross_retry)
          and candidate.ordinal = 2
      ),
      'showcrafter.engine-render-publication.v1',
      (
        select candidate.metrics -> 'engineRender'
        from public.import_candidates candidate
        where candidate.import_run_id = (select id from cross_retry)
          and candidate.ordinal = 2
      ),
      (
        select candidate.rendered_video_path
        from public.import_candidates candidate
        where candidate.import_run_id = (select id from cross_retry)
          and candidate.ordinal = 2
      )
    );
    raise exception 'Weak fade score unexpectedly passed publication sealing.';
  exception
    when sqlstate '22023' then null;
  end;

  begin
    perform public.seal_firework_import_render_validation(
      (
        select candidate.id
        from public.import_candidates candidate
        where candidate.import_run_id = (select id from cross_retry)
          and candidate.ordinal = 3
      ),
      'showcrafter.engine-render-publication.v1',
      (
        select candidate.metrics -> 'engineRender'
        from public.import_candidates candidate
        where candidate.import_run_id = (select id from cross_retry)
          and candidate.ordinal = 3
      ),
      (
        select candidate.rendered_video_path
        from public.import_candidates candidate
        where candidate.import_run_id = (select id from cross_retry)
          and candidate.ordinal = 3
      )
    );
    raise exception 'Missing renderer contract unexpectedly passed publication sealing.';
  exception
    when sqlstate '22023' then null;
  end;

  begin
    perform public.seal_firework_import_render_validation(
      (
        select candidate.id
        from public.import_candidates candidate
        where candidate.import_run_id = (select id from cross_retry)
          and candidate.ordinal = 4
      ),
      'showcrafter.engine-render-publication.v1',
      (
        select candidate.metrics -> 'engineRender'
        from public.import_candidates candidate
        where candidate.import_run_id = (select id from cross_retry)
          and candidate.ordinal = 4
      ),
      (
        select candidate.rendered_video_path
        from public.import_candidates candidate
        where candidate.import_run_id = (select id from cross_retry)
          and candidate.ordinal = 4
      )
    );
    raise exception 'Missing renderer duration provenance unexpectedly passed publication sealing.';
  exception
    when sqlstate '22023' then null;
  end;

  if exists (
    select 1
    from public.import_candidate_render_validations validation
    join public.import_candidates candidate on candidate.id = validation.candidate_id
    where candidate.import_run_id = (select id from cross_retry)
      and candidate.ordinal in (1, 2, 3, 4)
  ) then
    raise exception 'Rejected engine evidence left a publication seal.';
  end if;
end;
$$;

select public.seal_firework_import_render_validation(
  (select candidate_id from cross_selected_candidate),
  'showcrafter.engine-render-publication.v1',
  (
    select candidate.metrics -> 'engineRender'
    from public.import_candidates candidate
    where candidate.id = (select candidate_id from cross_selected_candidate)
  ),
  (
    select candidate.rendered_video_path
    from public.import_candidates candidate
    where candidate.id = (select candidate_id from cross_selected_candidate)
  )
);

do $$
declare
  cross_retry_id uuid := (select id from cross_retry);
  source_path text := (
    select asset.storage_path
    from public.import_runs run
    join public.import_jobs job on job.id = run.import_job_id
    join public.media_assets asset on asset.id = job.media_asset_id
    where run.id = (select id from cross_retry)
  );
  artifact_path text := (
    select validation.artifact_storage_path
    from public.import_candidate_render_validations validation
    where validation.candidate_id = (select candidate_id from cross_selected_candidate)
  );
begin
  if (select created_by from public.import_runs where id = cross_retry_id)
      <> '10000000-0000-0000-0000-000000000002'::uuid
    or split_part(source_path, '/', 1)
      <> '10000000-0000-0000-0000-000000000001'
    or split_part(artifact_path, '/', 1) <> split_part(source_path, '/', 1)
    or split_part(artifact_path, '/', 1)
      = (select created_by::text from public.import_runs where id = cross_retry_id)
    or (select renderer_contract_version
        from public.import_candidate_render_validations
        where candidate_id = (select candidate_id from cross_selected_candidate))
      <> 'showcrafter.fireworks-engine.import-renderer.v1+sha256.90a37b6ccf746f598adfb0ad88efed910b2b699a063cf5cbd2b0f2f04773358f'
    or (select balance from public.ai_credit_accounts
        where user_id = '10000000-0000-0000-0000-000000000002') <> 145
    or (select reserved from public.ai_credit_accounts
        where user_id = '10000000-0000-0000-0000-000000000002') <> 0
    or (select credit_status from public.import_runs where id = cross_retry_id) <> 'settled'
    or (select count(*) from public.ai_credit_transactions
        where reference_type = 'import_run'
          and reference_id = cross_retry_id
          and transaction_type = 'debit'
          and status = 'applied') <> 1 then
    raise exception 'Cross-admin retry did not retain source-owned artefacts or settle credits once.';
  end if;
end;
$$;

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
set local request.jwt.claim.role = 'authenticated';

insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
values (
  'import-videos',
  '10000000-0000-0000-0000-000000000001/multishot.mp4',
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '{"mimetype":"video/mp4","size":"2048"}'::jsonb
);

create temporary table second_import as
select *
from public.finalise_firework_video_import(
  'Two shot reconstruction',
  '10000000-0000-0000-0000-000000000001/multishot.mp4',
  'multishot.mp4',
  'openai/gpt-5.4',
  6
);

set local request.jwt.claim.role = 'service_role';

create temporary table second_claim as
select *
from public.claim_firework_import_run(
  'firework-reconstruction-test',
  (select run_id from second_import),
  900
);

create temporary table second_completion_payload as
select jsonb_build_array(
    jsonb_build_object(
      'ordinal', 0,
      'schemaVersion', 'showcrafter.firework-reconstruction.v1',
      'reconstruction', jsonb_build_object(
        'version', 1,
        'name', 'Two shot reconstruction',
        'description', 'Red peony then green ring.',
        'durationSeconds', 6,
        'confidence', 0.88,
        'designs', jsonb_build_array(
          jsonb_build_object(
            'key', 'red-peony',
            'effectSlug', 'peony',
            'design', pg_temp.canonical_firework_design(),
            'colorPalette', jsonb_build_array('#ff0000'),
            'durationSeconds', 4,
            'heightMeters', 35,
            'caliber', '30mm',
            'confidence', 0.9
          ),
          jsonb_build_object(
            'key', 'green-ring',
            'effectSlug', 'ring',
            'design', pg_temp.canonical_firework_design(),
            'colorPalette', jsonb_build_array('#00ff00'),
            'durationSeconds', 4,
            'heightMeters', 40,
            'caliber', '35mm',
            'confidence', 0.86
          )
        ),
        'shots', jsonb_build_array(
          jsonb_build_object(
            'id', 'shot-1',
            'designKey', 'red-peony',
            'timeOffsetSeconds', 0,
            'panDegrees', -12,
            'tiltDegrees', 8,
            'position', jsonb_build_object('x', -5, 'y', 0, 'z', 0),
            'seed', 201,
            'scale', 1
          ),
          jsonb_build_object(
            'id', 'shot-2',
            'designKey', 'green-ring',
            'timeOffsetSeconds', 1.25,
            'panDegrees', 12,
            'tiltDegrees', 8,
            'position', jsonb_build_object('x', 5, 'y', 0, 'z', 0),
            'seed', 202,
            'scale', 1.1
          )
        )
      ),
      'score', 0.88,
      'metrics', jsonb_build_object('timing', 0.92),
      'validation', jsonb_build_object('valid', true, 'blockers', jsonb_build_array()),
      'contentHash', repeat('c', 64)
    )
  ) as candidates;

update second_completion_payload
set candidates = jsonb_set(
  jsonb_set(
    candidates,
    '{0,metrics}',
    jsonb_build_object(
      'engineRender',
      pg_temp.engine_evidence(
        candidates -> 0 -> 'reconstruction',
        6,
        '10000000-0000-0000-0000-000000000001/engine-review-'
          || (select run_id from second_import)::text
          || '-2222222222222222.mp4',
        repeat('c', 64),
        4096,
        repeat('2', 32)
      )
    )
  ),
  '{0,renderedVideoPath}',
  to_jsonb(
    '10000000-0000-0000-0000-000000000001/engine-review-'
      || (select run_id from second_import)::text
      || '-2222222222222222.mp4'
  )
);

insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
select
  'import-videos',
  candidates -> 0 ->> 'renderedVideoPath',
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  jsonb_build_object(
    'mimetype', 'video/mp4',
    'size', '4096',
    'eTag', repeat('2', 32)
  )
from second_completion_payload;

select public.append_firework_import_run_output(
  (select run_id from second_claim),
  (select lease_token from second_claim),
  'engine_validation',
  1,
  'render_metrics',
  'showcrafter.import-render-result.v1',
  (select candidates -> 0 -> 'metrics' -> 'engineRender' from second_completion_payload),
  repeat('1', 64),
  (select candidates -> 0 ->> 'renderedVideoPath' from second_completion_payload)
);

create temporary table second_candidate as
select public.complete_firework_import_run(
  (select run_id from second_claim),
  (select lease_token from second_claim),
  (select candidates from second_completion_payload),
  0
) as candidate_id;

select public.seal_firework_import_candidate(
  (select candidate_id from second_candidate),
  'showcrafter.firework-design.v1',
  jsonb_set(
    jsonb_set(
      (select reconstruction from public.import_candidates where id = (select candidate_id from second_candidate)),
      '{designs,0,design}',
      pg_temp.canonical_firework_design()
    ),
    '{designs,1,design}',
    pg_temp.canonical_firework_design()
  ),
  (select content_hash from public.import_candidates where id = (select candidate_id from second_candidate))
);

select public.seal_firework_import_render_validation(
  (select candidate_id from second_candidate),
  'showcrafter.engine-render-publication.v1',
  (select candidates -> 0 -> 'metrics' -> 'engineRender' from second_completion_payload),
  (select candidates -> 0 ->> 'renderedVideoPath' from second_completion_payload)
);

set local request.jwt.claim.role = 'authenticated';

create temporary table second_approval as
select *
from public.approve_firework_import_candidate(
  (select job_id from second_import),
  (select candidate_id from second_candidate),
  'IMPORT-MULTI-1',
  'Two shot reconstruction',
  'ShowCrafter test',
  'Cake',
  'Two shot cake'
);

do $$
declare
  approved_multishot_id uuid := (select multishot_id from second_approval);
begin
  if approved_multishot_id is null
    or (select shot_count from public.multishots where id = approved_multishot_id) <> 2
    or (select count(*) from public.multishot_fireworks where multishot_id = approved_multishot_id) <> 2
    or (select catalogue_item_kind from public.catalogue_items where multishot_id = approved_multishot_id) <> 'multishot'
    or (select is_listed from public.catalogue_items where multishot_id = approved_multishot_id) is not true
    or exists (
      select 1
      from public.catalogue_items item
      join public.multishot_fireworks shot on shot.firework_id = item.firework_id
      where shot.multishot_id = approved_multishot_id
        and item.is_listed
    )
    or (select position_override_json ->> 'seedOverride'
        from public.multishot_fireworks
        where multishot_id = approved_multishot_id
        order by sequence_index
        limit 1) <> '201'
    or (select position_override_json ->> 'launchPositionIndex'
        from public.multishot_fireworks
        where multishot_id = approved_multishot_id
        order by sequence_index
        limit 1) <> '0'
    or (select caliber
        from public.multishot_fireworks
        where multishot_id = approved_multishot_id
        order by sequence_index desc
        limit 1) <> '38.5mm' then
    raise exception 'Multishot approval did not preserve its canonical shot sequence.';
  end if;
end;
$$;

insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
values (
  'import-videos',
  '10000000-0000-0000-0000-000000000001/lease-recovery.mp4',
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '{"mimetype":"video/mp4","size":"2048"}'::jsonb
);

create temporary table recovery_import as
select *
from public.finalise_firework_video_import(
  'Lease recovery reconstruction',
  '10000000-0000-0000-0000-000000000001/lease-recovery.mp4',
  'lease-recovery.mp4',
  'openai/gpt-5.4',
  4
);
grant select on recovery_import to authenticated;
grant select, update, delete on public.import_jobs to authenticated;
grant select, delete on public.media_assets to authenticated;

set local request.jwt.claim.role = 'service_role';

create temporary table expired_claim as
select *
from public.claim_firework_import_run(
  'firework-reconstruction-test',
  (select run_id from recovery_import),
  900
);

update public.import_runs
set lease_expires_at = now() - interval '1 second'
where id = (select run_id from expired_claim);

create temporary table recovered_claim as
select *
from public.claim_firework_import_run(
  'firework-reconstruction-test',
  (select run_id from expired_claim),
  900
);

do $$
begin
  if (select run_id from recovered_claim) = (select run_id from expired_claim)
    or (select parent_run_id from public.import_runs where id = (select run_id from recovered_claim))
      <> (select run_id from expired_claim)
    or (select status from public.import_runs where id = (select run_id from expired_claim)) <> 'failed'
    or (select attempt_number from public.import_runs where id = (select run_id from recovered_claim)) <> 2 then
    raise exception 'Expired reconstruction lease was not recovered into a new attempt.';
  end if;
end;
$$;

select public.record_firework_import_run_context(
  (select run_id from recovered_claim),
  (select lease_token from recovered_claim),
  repeat('a', 64),
  'firework-reconstruction-test',
  'showcrafter.firework-design.v1',
  'openai/gpt-5.4',
  '{}'::jsonb,
  '{}'::jsonb
);

update public.import_runs
set lease_expires_at = now() - interval '1 second'
where id = (select run_id from recovered_claim);

create temporary table second_recovered_claim as
select *
from public.claim_firework_import_run(
  'firework-reconstruction-test',
  (select run_id from recovered_claim),
  900
);

select public.record_firework_import_run_context(
  (select run_id from second_recovered_claim),
  (select lease_token from second_recovered_claim),
  repeat('b', 64),
  'firework-reconstruction-test',
  'showcrafter.firework-design.v1',
  'openai/gpt-5.4',
  '{}'::jsonb,
  '{}'::jsonb
);

update public.import_runs
set lease_expires_at = now() - interval '1 second'
where id = (select run_id from second_recovered_claim);

create temporary table exhausted_recovery_claim as
select *
from public.claim_firework_import_run(
  'firework-reconstruction-test',
  (select run_id from second_recovered_claim),
  900
);

do $$
begin
  if (select lease_recovery_count from public.import_runs
      where id = (select run_id from recovered_claim)) <> 1
    or (select lease_recovery_count from public.import_runs
        where id = (select run_id from second_recovered_claim)) <> 2
    or exists (select 1 from exhausted_recovery_claim)
    or (select status from public.import_jobs
        where id = (select job_id from recovery_import)) <> 'failed' then
    raise exception 'Worker lease recovery did not stop after two durable retries.';
  end if;
end;
$$;

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';

create temporary table forbidden_video_job_update as
with changed as (
  update public.import_jobs
  set source_name = 'RLS bypass attempt'
  where id = (select job_id from recovery_import)
  returning id
)
select * from changed;

create temporary table forbidden_video_job_delete as
with changed as (
  delete from public.import_jobs
  where id = (select job_id from recovery_import)
  returning id
)
select * from changed;

create temporary table forbidden_source_delete as
with changed as (
  delete from public.media_assets
  where id = (
    select media_asset_id
    from public.import_jobs
    where id = (select job_id from recovery_import)
  )
  returning id
)
select * from changed;

select public.archive_firework_import_job((select job_id from recovery_import));

do $$
begin
  if exists (select 1 from forbidden_video_job_update)
    or exists (select 1 from forbidden_video_job_delete)
    or exists (select 1 from forbidden_source_delete)
    or (select archived_at from public.import_jobs
        where id = (select job_id from recovery_import)) is null
    or not exists (
      select 1
      from public.import_runs
      where import_job_id = (select job_id from recovery_import)
    ) then
    raise exception 'Video import RLS or audit-safe archival was bypassed.';
  end if;
end;
$$;

reset role;

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
set local request.jwt.claim.role = 'authenticated';

create temporary table dispatch_failure_credit_before as
select account.balance, account.reserved
from public.ai_credit_accounts account
where account.user_id = '10000000-0000-0000-0000-000000000001';

insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
values (
  'import-videos',
  '10000000-0000-0000-0000-000000000001/dispatch-failure.mp4',
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '{"mimetype":"video/mp4","size":"1024"}'::jsonb
);

create temporary table dispatch_failure_import as
select *
from public.finalise_firework_video_import(
  'Dispatch failure reconstruction',
  '10000000-0000-0000-0000-000000000001/dispatch-failure.mp4',
  'dispatch-failure.mp4',
  'openai/gpt-5.4',
  4
);

do $$
begin
  if (select account.balance from public.ai_credit_accounts account
      where account.user_id = '10000000-0000-0000-0000-000000000001')
        <> (select balance from dispatch_failure_credit_before)
    or (select account.reserved from public.ai_credit_accounts account
        where account.user_id = '10000000-0000-0000-0000-000000000001')
        <> (select reserved + 5 from dispatch_failure_credit_before) then
    raise exception 'Dispatch-failure reconstruction credits were not reserved exactly once.';
  end if;
end;
$$;

set local request.jwt.claim.role = 'service_role';

select public.begin_firework_import_dispatch((select run_id from dispatch_failure_import));

do $$
begin
  if public.record_firework_import_dispatch_result(
    (select run_id from dispatch_failure_import),
    'exhausted',
    3,
    null,
    'Modal dispatch returned HTTP 503.'
  ) <> 'failed' then
    raise exception 'Exhausted dispatch did not close the queued run.';
  end if;

  if (select status from public.import_runs
      where id = (select run_id from dispatch_failure_import)) <> 'failed'
    or (select stage from public.import_runs
        where id = (select run_id from dispatch_failure_import)) <> 'dispatch_failed'
    or (select direct_dispatch_status from public.import_runs
        where id = (select run_id from dispatch_failure_import)) <> 'failed'
    or (select credit_status from public.import_runs
        where id = (select run_id from dispatch_failure_import)) <> 'refunded'
    or (select status from public.import_jobs
        where id = (select job_id from dispatch_failure_import)) <> 'failed'
    or (select account.balance from public.ai_credit_accounts account
        where account.user_id = '10000000-0000-0000-0000-000000000001')
        <> (select balance from dispatch_failure_credit_before)
    or (select account.reserved from public.ai_credit_accounts account
        where account.user_id = '10000000-0000-0000-0000-000000000001')
        <> (select reserved from dispatch_failure_credit_before)
    or (select count(*) from public.ai_credit_transactions
        where reference_type = 'import_run'
          and reference_id = (select run_id from dispatch_failure_import)
          and transaction_type = 'refund'
          and status = 'applied') <> 1 then
    raise exception 'Exhausted dispatch was not failed and refunded atomically.';
  end if;

  if public.record_firework_import_dispatch_result(
    (select run_id from dispatch_failure_import),
    'exhausted',
    3,
    null,
    'Modal dispatch returned HTTP 503.'
  ) <> 'failed'
    or (select count(*) from public.ai_credit_transactions
        where reference_type = 'import_run'
          and reference_id = (select run_id from dispatch_failure_import)
          and transaction_type = 'refund'
          and status = 'applied') <> 1 then
    raise exception 'Dispatch failure replay duplicated its credit refund.';
  end if;

  if (select account.balance from public.ai_credit_accounts account
      where account.user_id = '10000000-0000-0000-0000-000000000001')
      <> (select balance from dispatch_failure_credit_before)
    or (select account.reserved from public.ai_credit_accounts account
        where account.user_id = '10000000-0000-0000-0000-000000000001')
      <> (select reserved from dispatch_failure_credit_before) then
    raise exception 'Dispatch failure replay changed the credit account.';
  end if;
end;
$$;

create temporary table dispatch_failure_late_claim as
select *
from public.claim_firework_import_run(
  'firework-reconstruction-test',
  (select run_id from dispatch_failure_import),
  900
);

do $$
begin
  if exists (select 1 from dispatch_failure_late_claim) then
    raise exception 'A worker claimed a run after dispatch failure refunded it.';
  end if;
end;
$$;

set local request.jwt.claim.role = 'authenticated';

insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
values (
  'import-videos',
  '10000000-0000-0000-0000-000000000001/dispatch-race.mp4',
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '{"mimetype":"video/mp4","size":"1024"}'::jsonb
);

create temporary table dispatch_race_import as
select *
from public.finalise_firework_video_import(
  'Dispatch race reconstruction',
  '10000000-0000-0000-0000-000000000001/dispatch-race.mp4',
  'dispatch-race.mp4',
  'openai/gpt-5.4',
  4
);

set local request.jwt.claim.role = 'service_role';

select public.begin_firework_import_dispatch((select run_id from dispatch_race_import));

create temporary table dispatch_race_claim as
select *
from public.claim_firework_import_run(
  'firework-reconstruction-test',
  (select run_id from dispatch_race_import),
  900
);

do $$
begin
  if public.record_firework_import_dispatch_result(
    (select run_id from dispatch_race_import),
    'exhausted',
    3,
    null,
    'Modal dispatch request timed out.'
  ) <> 'worker_claimed'
    or (select status from public.import_runs
        where id = (select run_id from dispatch_race_import)) <> 'processing'
    or (select direct_dispatch_status from public.import_runs
        where id = (select run_id from dispatch_race_import)) <> 'worker_claimed'
    or (select credit_status from public.import_runs
        where id = (select run_id from dispatch_race_import)) <> 'reserved'
    or (select status from public.import_jobs
        where id = (select job_id from dispatch_race_import)) <> 'processing' then
    raise exception 'Dispatch failure cancelled a run already claimed by the worker.';
  end if;
end;
$$;

do $$
begin
  if public.record_firework_import_dispatch_result(
    (select run_id from dispatch_race_import),
    'exhausted',
    3,
    null,
    'Modal dispatch request timed out.'
  ) <> 'worker_claimed' then
    raise exception 'Identical claim-race dispatch replay was not idempotent.';
  end if;

  begin
    perform public.record_firework_import_dispatch_result(
      (select run_id from dispatch_race_import),
      'exhausted',
      2,
      null,
      'Different dispatch error.'
    );
    raise exception 'Claim-race dispatch provenance was mutable.';
  exception
    when sqlstate '55000' then null;
  end;

  begin
    perform public.record_firework_import_dispatch_result(
      (select run_id from dispatch_race_import),
      'accepted',
      3,
      'late-dispatch-acceptance',
      null
    );
    raise exception 'Exhausted claim-race dispatch was later accepted.';
  exception
    when sqlstate '55000' then null;
  end;

  if (select direct_dispatch_attempt_count from public.import_runs
      where id = (select run_id from dispatch_race_import)) <> 3
    or (select direct_dispatch_error from public.import_runs
        where id = (select run_id from dispatch_race_import))
      <> 'Modal dispatch request timed out.' then
    raise exception 'Claim-race dispatch replay changed retained provenance.';
  end if;
end;
$$;

select public.fail_firework_import_run(
  (select run_id from dispatch_race_claim),
  (select lease_token from dispatch_race_claim),
  'Synthetic cleanup after dispatch race'
);

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'import_runs'
      and policyname = 'import_runs_admin_select'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'import_candidates'
      and policyname = 'import_candidates_admin_select'
  ) or exists (
    select 1 from information_schema.routine_privileges
    where routine_schema = 'public'
      and routine_name = 'claim_firework_import_run'
      and grantee in ('PUBLIC', 'anon', 'authenticated')
      and privilege_type = 'EXECUTE'
  ) or exists (
    select 1 from information_schema.routine_privileges
    where routine_schema = 'public'
      and routine_name in (
        'check_firework_import_dispatch_ready',
        'begin_firework_import_dispatch',
        'record_firework_import_dispatch_result'
      )
      and grantee in ('PUBLIC', 'anon', 'authenticated')
      and privilege_type = 'EXECUTE'
  ) or not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.import_runs'::regclass
      and tgname = 'import_runs_mark_worker_claimed_before_processing'
      and not tgisinternal
  ) or exists (
    select 1 from information_schema.routine_privileges
    where routine_schema = 'private'
      and routine_name = 'mark_firework_import_worker_claimed'
      and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
      and privilege_type = 'EXECUTE'
  ) then
    raise exception 'Import run RLS, dispatch hooks or worker grants are not least privilege.';
  end if;
end;
$$;

rollback;
