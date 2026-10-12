begin;

-- Compare new import output with the pre-existing bootstrap catalogue.
create temporary table original_fireworks as select id from public.fireworks;
create temporary table original_catalogue_items as select id from public.catalogue_items;

-- The renderer's peony template, stored as a version 1 design.
create function pg_temp.canonical_firework_design()
returns jsonb
language sql
immutable
as $$
  select '{"kind":"shell","launch":{"height_m":60,"time_s":1.8,"tilt_deg":0,"tail":"gold","sparks":180,"spread":1.4,"smoke":1},"breaks":[{"at_s":0,"core":{"enabled":true,"colour":"#ff3b2f","count":110,"radius":0.5,"flash":1,"flash_on":true,"ring":false},"fade":{"white_hot":0.03,"ember_at":0.8,"fade_at":0.72,"prime_s":0.25},"layers":[{"id":"l1","name":"Red and green petals","pattern":"sphere","count":90,"radius_m":26,"tilt":0.4,"speed_var":0.22,"drag_per_s":2.6,"gravity_m_s2":9,"life_s":2.2,"life_var":0.2,"delay_s":0,"offset_m":[0,0,0],"flash":true,"hidden":false,"colour":{"mode":"alternate","stops":[[0,["#ff3048","#2fe06a"]],[1,["#ff3048","#2fe06a"]]]},"brightness":[[0,1.5],[1,1.5]],"head":{"size":1.1,"visible":true},"trail":{"sparks":10,"length_s":0.25,"spread_m_s":0.4,"gravity_m_s2":3,"drag_per_s":2.6,"size":1,"flicker":0.3,"colour":"star","glitter":0,"glitter_delay_s":0.35,"fork":0},"modifiers":[]}]}],"ground":null,"sound":{"lift":0.7,"break":0.85,"crackle":0.6,"whistle":0},"seed":11}'::jsonb;
$$;

-- Worker fit evidence with one scored entry per reconstructed shot.
create function pg_temp.fit_metrics(p_reconstruction jsonb)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'source', 'fitted',
    'fit', jsonb_build_object(
      'schemaVersion', 'showcrafter.import-fit-evidence.v1',
      'rendererVersion', '0.9.1',
      'overall', 0.82,
      'timedOut', false,
      'shots', (
        select jsonb_agg(
          jsonb_build_object('index', ordinality - 1, 'overall', 0.82, 'distances', '{}'::jsonb)
          order by ordinality
        )
        from jsonb_array_elements(p_reconstruction -> 'shots') with ordinality
      )
    )
  );
$$;

create function pg_temp.single_reconstruction(
  p_name text,
  p_description text,
  p_design_key text,
  p_pan integer
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'version', 2,
    'name', p_name,
    'description', p_description,
    'durationSeconds', 4,
    'designs', jsonb_build_array(
      jsonb_build_object(
        'key', p_design_key,
        'template', 'peony',
        'label', 'Peony',
        'design', pg_temp.canonical_firework_design(),
        'colorPalette', jsonb_build_array('#ff0000'),
        'durationSeconds', 4
      )
    ),
    'shots', jsonb_build_array(
      jsonb_build_object(
        'id', '0',
        'designKey', p_design_key,
        'timeOffsetSeconds', 0,
        'panDegrees', p_pan,
        'x', 0.5
      )
    ),
    'source', jsonb_build_object('durationSeconds', 5, 'firstShotSeconds', 0.5, 'extractor', 'test')
  );
$$;

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
set local request.jwt.claim.role = 'authenticated';

insert into public.permissions (key, name, category)
values
  ('admin.manage_imports', 'Manage imports', 'admin'),
  ('admin.manage_catalogue', 'Manage catalogue', 'admin')
on conflict (key) do nothing;

insert into public.roles (key, name)
values
  ('user', 'User'),
  ('import-test-admin', 'Import test admin')
on conflict (key) do nothing;

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
)
on conflict (id) do nothing;

insert into public.firework_effects (slug, name, pattern_key, model_json, source)
values
  ('peony', 'Peony', 'sphere', '{}'::jsonb, 'reference'),
  ('ring', 'Ring', 'ring', '{}'::jsonb, 'reference')
on conflict (slug) do nothing;

-- Approval resolves each design's catalogue effect from its renderer template.
update public.firework_effects
set template_key = 'peony'
where slug = 'peony'
  and not exists (select 1 from public.firework_effects where template_key = 'peony');

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
  'showcrafter.renderer-design.v1',
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
      'schemaVersion', 'showcrafter.firework-reconstruction.v2',
      'reconstruction', pg_temp.single_reconstruction('Single reconstruction', 'One red peony.', 'a', 12),
      'score', 0.82,
      'metrics', pg_temp.fit_metrics(
        pg_temp.single_reconstruction('Single reconstruction', 'One red peony.', 'a', 12)
      ),
      'validation', jsonb_build_object('valid', true, 'issues', jsonb_build_array()),
      'contentHash', repeat('b', 64)
    )
  ) as candidates;

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
  if exists (select 1 from public.fireworks where id not in (select id from original_fireworks)) then
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
      'showcrafter.firework-reconstruction.v2',
      (
        select reconstruction
        from public.import_candidates
        where id = (select candidate_id from first_candidate)
      ) - 'version',
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

  begin
    perform public.seal_firework_import_candidate(
      (select candidate_id from first_candidate),
      'showcrafter.firework-reconstruction.v2',
      jsonb_set(
        (
          select reconstruction
          from public.import_candidates
          where id = (select candidate_id from first_candidate)
        ),
        '{designs,0,design,kind}',
        '"teapot"'
      ),
      (
        select content_hash
        from public.import_candidates
        where id = (select candidate_id from first_candidate)
      )
    );
    raise exception 'A design outside the renderer schema unexpectedly sealed.';
  exception
    when sqlstate '22023' then null;
  end;

  begin
    perform public.seal_firework_import_candidate(
      (select candidate_id from first_candidate),
      'showcrafter.firework-reconstruction.v2',
      jsonb_set(
        (
          select reconstruction
          from public.import_candidates
          where id = (select candidate_id from first_candidate)
        ),
        '{shots,0,panDegrees}',
        '-11'
      ),
      (
        select content_hash
        from public.import_candidates
        where id = (select candidate_id from first_candidate)
      )
    );
    raise exception 'A reconstruction differing from the stored candidate unexpectedly sealed.';
  exception
    when sqlstate '55000' then null;
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
  'showcrafter.firework-reconstruction.v2',
  (select reconstruction from public.import_candidates where id = (select candidate_id from first_candidate)),
  (select content_hash from public.import_candidates where id = (select candidate_id from first_candidate))
);

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
  expected_ledger_rows bigint;
  imported public.fireworks;
begin
  select job.approval_request_hash, job.approved_at
  into expected_approval_hash, expected_approved_at
  from public.import_jobs job
  where job.id = (select job_id from first_import);

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
  select * into imported from public.fireworks where id not in (select id from original_fireworks);
  if repeated_catalogue_id <> (select catalogue_item_id from first_approval)
    or (select count(*) from public.fireworks where id not in (select id from original_fireworks)) <> 1
    or (select count(*) from public.catalogue_items where id not in (select id from original_catalogue_items)) <> 1
    or (select duration_seconds from public.catalogue_items where id = repeated_catalogue_id) <> 4
    or imported.design_schema <> 1
    or imported.design is distinct from pg_temp.canonical_firework_design()
    or imported.firework_effect_id is distinct from (
      select id from public.firework_effects where template_key = 'peony'
    )
    or imported.variant_json -> 'reconstructionShot' ->> 'panDegrees' <> '12'
    or (select approval_request_hash from public.import_jobs
        where id = (select job_id from first_import)) is distinct from expected_approval_hash
    or (select approved_at from public.import_jobs
        where id = (select job_id from first_import)) is distinct from expected_approved_at
    or (select count(*) from public.ai_credit_transactions
        where reference_type = 'import_run'
          and reference_id = (select run_id from first_import)) <> expected_ledger_rows then
    raise exception 'Single-shot approval stored the wrong design or changed on replay.';
  end if;
end;
$$;

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
    or (select count(*) from public.catalogue_items where id not in (select id from original_catalogue_items)) <> 1
    or (select count(*) from public.fireworks where id not in (select id from original_fireworks)) <> 1 then
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
      'cv',
      -4
    ) as valid,
    pg_temp.single_reconstruction(
      'Cross-admin unfitted reconstruction',
      'A candidate stored without renderer fit evidence.',
      'cu',
      0
    ) as unfitted,
    pg_temp.single_reconstruction(
      'Cross-admin partial fit',
      'A candidate whose fit evidence misses a shot.',
      'cp',
      0
    ) as partial
)
select jsonb_build_array(
  jsonb_build_object(
    'ordinal', 0,
    'schemaVersion', 'showcrafter.firework-reconstruction.v2',
    'reconstruction', valid,
    'score', 0.82,
    'metrics', pg_temp.fit_metrics(valid),
    'validation', jsonb_build_object('valid', true, 'issues', jsonb_build_array()),
    'contentHash', repeat('d', 64)
  ),
  jsonb_build_object(
    'ordinal', 1,
    'schemaVersion', 'showcrafter.firework-reconstruction.v2',
    'reconstruction', unfitted,
    'score', 0.5,
    'metrics', jsonb_build_object('source', 'model'),
    'validation', jsonb_build_object('valid', true, 'issues', jsonb_build_array()),
    'contentHash', repeat('e', 64)
  ),
  jsonb_build_object(
    'ordinal', 2,
    'schemaVersion', 'showcrafter.firework-reconstruction.v2',
    'reconstruction', partial,
    'score', 0.5,
    'metrics', jsonb_set(pg_temp.fit_metrics(partial), '{fit,shots}', '[]'::jsonb),
    'validation', jsonb_build_object('valid', true, 'issues', jsonb_build_array()),
    'contentHash', repeat('f', 64)
  )
) as candidates
from reconstructions;

create temporary table cross_selected_candidate as
select public.complete_firework_import_run(
  (select run_id from cross_retry_claim),
  (select lease_token from cross_retry_claim),
  (select candidates from cross_completion_payload),
  0
) as candidate_id;

select public.seal_firework_import_candidate(
  candidate.id,
  'showcrafter.firework-reconstruction.v2',
  candidate.reconstruction,
  candidate.content_hash
)
from public.import_candidates candidate
where candidate.import_run_id = (select id from cross_retry)
order by candidate.ordinal;

do $$
declare
  cross_retry_id uuid := (select id from cross_retry);
begin
  if (select created_by from public.import_runs where id = cross_retry_id)
      <> '10000000-0000-0000-0000-000000000002'::uuid
    or (select count(*) from public.import_candidate_validations validation
        join public.import_candidates candidate on candidate.id = validation.candidate_id
        where candidate.import_run_id = cross_retry_id) <> 3
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
    raise exception 'Cross-admin retry did not seal its candidates or settle credits once.';
  end if;
end;
$$;

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
set local request.jwt.claim.role = 'authenticated';

do $$
declare
  rejected_ordinal integer;
begin
  foreach rejected_ordinal in array array[1, 2] loop
    perform public.select_firework_import_candidate(
      (select job_id from cross_initial_import),
      (
        select candidate.id
        from public.import_candidates candidate
        where candidate.import_run_id = (select id from cross_retry)
          and candidate.ordinal = rejected_ordinal
      )
    );
    begin
      perform public.approve_firework_import_candidate(
        (select job_id from cross_initial_import),
        (
          select candidate.id
          from public.import_candidates candidate
          where candidate.import_run_id = (select id from cross_retry)
            and candidate.ordinal = rejected_ordinal
        ),
        'CROSS-NO-FIT-' || rejected_ordinal,
        'Unfitted reconstruction'
      );
      raise exception 'A candidate without complete fit evidence was approved.';
    exception
      when sqlstate '55000' then null;
    end;
  end loop;
  if exists (
    select 1 from public.fireworks
    where id not in (select id from original_fireworks)
      and variant_json ->> 'importJobId' = (select job_id from cross_initial_import)::text
  ) then
    raise exception 'Rejected fit evidence left partial catalogue data.';
  end if;
end;
$$;

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

create function pg_temp.two_shot_reconstruction()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'version', 2,
    'name', 'Two shot reconstruction',
    'description', 'Red peony then a green peony.',
    'durationSeconds', 6,
    'designs', jsonb_build_array(
      jsonb_build_object(
        'key', 'a',
        'template', 'peony',
        'label', 'Red peony',
        'design', pg_temp.canonical_firework_design(),
        'colorPalette', jsonb_build_array('#ff0000'),
        'durationSeconds', 4
      ),
      jsonb_build_object(
        'key', 'b',
        'template', 'peony',
        'label', 'Green peony',
        'design', pg_temp.canonical_firework_design(),
        'colorPalette', jsonb_build_array('#00ff00'),
        'durationSeconds', 4
      )
    ),
    'shots', jsonb_build_array(
      jsonb_build_object('id', '0', 'designKey', 'a', 'timeOffsetSeconds', 0, 'panDegrees', -6, 'x', 0.4),
      jsonb_build_object('id', '1', 'designKey', 'b', 'timeOffsetSeconds', 2, 'panDegrees', 9, 'x', 0.6)
    ),
    'source', jsonb_build_object('durationSeconds', 7, 'firstShotSeconds', 1, 'extractor', 'test')
  );
$$;

create temporary table second_completion_payload as
select jsonb_build_array(
  jsonb_build_object(
    'ordinal', 0,
    'schemaVersion', 'showcrafter.firework-reconstruction.v2',
    'reconstruction', pg_temp.two_shot_reconstruction(),
    'score', 0.78,
    'metrics', pg_temp.fit_metrics(pg_temp.two_shot_reconstruction()),
    'validation', jsonb_build_object('valid', true, 'issues', jsonb_build_array()),
    'contentHash', repeat('c', 64)
  )
) as candidates;

create temporary table second_candidate as
select public.complete_firework_import_run(
  (select run_id from second_claim),
  (select lease_token from second_claim),
  (select candidates from second_completion_payload),
  0
) as candidate_id;

select public.seal_firework_import_candidate(
  (select candidate_id from second_candidate),
  'showcrafter.firework-reconstruction.v2',
  (select reconstruction from public.import_candidates where id = (select candidate_id from second_candidate)),
  (select content_hash from public.import_candidates where id = (select candidate_id from second_candidate))
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
    or exists (
      select 1
      from public.multishot_fireworks shot
      join public.fireworks firework on firework.id = shot.firework_id
      where shot.multishot_id = approved_multishot_id
        and (firework.design_schema <> 1 or firework.design is null)
    )
    or (select array_agg(time_offset_seconds::numeric order by sequence_index)
        from public.multishot_fireworks
        where multishot_id = approved_multishot_id) <> array[0, 2]::numeric[]
    or (select array_agg(pan_degrees order by sequence_index)
        from public.multishot_fireworks
        where multishot_id = approved_multishot_id) <> array[-6, 9] then
    raise exception 'Multishot approval did not preserve its fitted shot sequence.';
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
  'showcrafter.renderer-design.v1',
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
  'showcrafter.renderer-design.v1',
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
