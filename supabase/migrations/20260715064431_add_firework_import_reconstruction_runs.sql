-- Durable, versioned reconstruction runs for firework video imports.
--
-- The original import workflow stored unrelated attempts in one mutable job
-- stream and published catalogue rows through independent client writes. This
-- migration keeps every processing attempt and candidate immutable, guards
-- worker writes with a lease, and publishes an approved candidate atomically.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create or replace function private.firework_import_sha256(p_value text)
returns text
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  result text;
begin
  if to_regprocedure('extensions.digest(bytea,text)') is not null then
    execute 'select encode(extensions.digest(convert_to($1, ''UTF8''), ''sha256''), ''hex'')'
      into result using p_value;
  elsif to_regprocedure('public.digest(bytea,text)') is not null then
    execute 'select encode(public.digest(convert_to($1, ''UTF8''), ''sha256''), ''hex'')'
      into result using p_value;
  else
    raise exception 'The pgcrypto digest function is not available.' using errcode = '55000';
  end if;
  return result;
end;
$$;

revoke execute on function private.firework_import_sha256(text)
  from public, anon, authenticated, service_role;

create table public.import_runs (
  id uuid primary key default gen_random_uuid(),
  import_job_id uuid not null references public.import_jobs(id) on delete cascade,
  parent_run_id uuid references public.import_runs(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  request_kind text not null check (request_kind in ('initial', 'retry', 'refinement')),
  request_prompt text,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'succeeded', 'failed', 'superseded')),
  stage text not null default 'queued',
  progress integer not null default 0 check (progress between 0 and 100),
  attempt_number integer not null check (attempt_number > 0),
  idempotency_key text not null unique,
  source_sha256 text,
  pipeline_version text not null default 'firework-reconstruction-v4',
  engine_schema_version text not null default 'showcrafter.firework-design.v1',
  selected_model text not null,
  video_model text,
  prompt_snapshot jsonb not null default '{}'::jsonb,
  model_snapshot jsonb not null default '{}'::jsonb,
  modal_call_id text,
  lease_recovery_count integer not null default 0
    check (lease_recovery_count between 0 and 2),
  completion_request_hash text,
  completion_lease_token uuid,
  failure_request_hash text,
  failure_lease_token uuid,
  credit_action_key text check (
    credit_action_key is null
    or credit_action_key in ('import_video_reconstruction', 'import_video_refinement')
  ),
  credit_reservation_key text,
  credit_status text check (
    credit_status is null or credit_status in ('reserved', 'settled', 'refunded')
  ),
  lease_token uuid,
  lease_expires_at timestamptz,
  heartbeat_at timestamptz,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (import_job_id, attempt_number),
  constraint import_runs_prompt_length check (char_length(coalesce(request_prompt, '')) <= 4000),
  constraint import_runs_source_sha256 check (
    source_sha256 is null or source_sha256 ~ '^[0-9a-f]{64}$'
  ),
  constraint import_runs_completion_request_hash check (
    completion_request_hash is null or completion_request_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint import_runs_failure_request_hash check (
    failure_request_hash is null or failure_request_hash ~ '^[0-9a-f]{64}$'
  )
);

-- Reconstruction uses several bounded model passes, but still shares the
-- wallet's 20-credit hourly cap. These costs allow one full run plus several
-- evidence-driven refinements without making the feature impossible to start.
insert into public.ai_credit_costs (key, name, description, amount, sort_order)
values
  (
    'import_video_reconstruction',
    'Import video reconstruction',
    'Bounded multi-pass reconstruction and exact engine comparison for a firework video.',
    5,
    70
  ),
  (
    'import_video_refinement',
    'Import video refinement',
    'Evidence-driven refinement of a retained firework reconstruction candidate.',
    3,
    80
  )
on conflict (key) do update
set name = excluded.name,
    description = excluded.description,
    amount = excluded.amount,
    sort_order = excluded.sort_order,
    updated_at = now();

create index import_runs_job_created_idx
  on public.import_runs (import_job_id, created_at desc);

create index import_runs_queue_idx
  on public.import_runs (created_at)
  where status = 'queued';

create table public.import_run_outputs (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid not null references public.import_runs(id) on delete cascade,
  stage text not null,
  sequence integer not null check (sequence >= 0),
  output_type text not null check (
    output_type in (
      'probe',
      'frame_observations',
      'audio_observations',
      'video_observations',
      'candidate_draft',
      'render_metrics',
      'critic_review',
      'processing_log'
    )
  ),
  schema_version text not null,
  content_hash text,
  payload jsonb not null,
  storage_path text,
  created_at timestamptz not null default now(),
  unique (import_run_id, stage, sequence),
  constraint import_run_outputs_content_hash check (
    content_hash is null or content_hash ~ '^[0-9a-f]{64}$'
  )
);

create index import_run_outputs_run_created_idx
  on public.import_run_outputs (import_run_id, created_at);

create table public.import_candidates (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid not null references public.import_runs(id) on delete cascade,
  ordinal integer not null check (ordinal >= 0),
  schema_version text not null,
  reconstruction jsonb not null,
  score numeric(6,5) not null check (score between 0 and 1),
  metrics jsonb not null default '{}'::jsonb,
  validation jsonb not null default '{}'::jsonb,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  rendered_video_path text,
  selected_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (import_run_id, ordinal),
  unique (import_run_id, content_hash),
  constraint import_candidates_reconstruction_object check (
    jsonb_typeof(reconstruction) = 'object'
  ),
  constraint import_candidates_validation_object check (
    jsonb_typeof(validation) = 'object'
  )
);

create table public.import_candidate_validations (
  candidate_id uuid not null references public.import_candidates(id) on delete cascade,
  validator_version text not null,
  canonical_reconstruction jsonb not null,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  primary key (candidate_id, validator_version),
  constraint import_candidate_validations_reconstruction_object check (
    jsonb_typeof(canonical_reconstruction) = 'object'
  )
);

create table public.import_candidate_render_validations (
  candidate_id uuid not null references public.import_candidates(id) on delete cascade,
  validator_version text not null,
  renderer_contract_version text not null,
  metrics_schema_version text not null,
  canonical_evidence jsonb not null,
  evidence_hash text not null check (evidence_hash ~ '^[0-9a-f]{64}$'),
  artifact_storage_path text not null,
  artifact_sha256 text not null check (artifact_sha256 ~ '^[0-9a-f]{64}$'),
  artifact_byte_size bigint not null check (artifact_byte_size > 0),
  artifact_storage_etag text not null check (
    artifact_storage_etag ~ '^[0-9a-f]{32}(-[1-9][0-9]*)?$'
  ),
  artifact_output_id uuid not null references public.import_run_outputs(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (candidate_id, validator_version),
  constraint import_candidate_render_validations_evidence_object check (
    jsonb_typeof(canonical_evidence) = 'object'
  )
);

create or replace function public.current_firework_import_validator_version()
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 'showcrafter.firework-design.v1'::text;
$$;

revoke execute on function public.current_firework_import_validator_version()
  from public, anon, authenticated;

create or replace function public.current_firework_import_render_validator_version()
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 'showcrafter.engine-render-publication.v1'::text;
$$;

revoke execute on function public.current_firework_import_render_validator_version()
  from public, anon, authenticated;

create or replace function public.current_firework_import_renderer_contract_version()
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 'showcrafter.fireworks-engine.import-renderer.v1+sha256.087d491030064d3e194ba5e0d72d65a3b47356e49ee6a2e05479103ccce32441'::text;
$$;

revoke execute on function public.current_firework_import_renderer_contract_version()
  from public, anon, authenticated;

alter table public.import_runs
  add column source_candidate_id uuid references public.import_candidates(id) on delete set null;

create index import_candidates_run_score_idx
  on public.import_candidates (import_run_id, score desc, ordinal);

alter table public.import_jobs
  add column active_run_id uuid references public.import_runs(id) on delete set null,
  add column selected_candidate_id uuid references public.import_candidates(id) on delete set null,
  add column approved_run_id uuid references public.import_runs(id) on delete set null,
  add column approved_candidate_id uuid references public.import_candidates(id) on delete set null,
  add column approval_request_hash text,
  add column selected_by uuid,
  add column selected_at timestamptz,
  add column approved_by uuid,
  add column approved_at timestamptz,
  add column archived_at timestamptz,
  add column archived_by uuid references auth.users(id) on delete set null,
  add constraint import_jobs_approval_request_hash check (
    approval_request_hash is null or approval_request_hash ~ '^[0-9a-f]{64}$'
  );

alter table public.catalogue_items
  add column is_listed boolean not null default true;

comment on column public.catalogue_items.is_listed is
  'Whether this row is a purchasable public catalogue entry. Internal renderer components remain admin-visible only.';

create index import_jobs_active_run_idx
  on public.import_jobs (active_run_id)
  where active_run_id is not null;

create unique index import_jobs_video_media_asset_key
  on public.import_jobs (media_asset_id)
  where kind = 'firework_video' and media_asset_id is not null;

create unique index media_assets_storage_path_key
  on public.media_assets (storage_path)
  where storage_path is not null;

create trigger import_runs_set_updated_at
  before update on public.import_runs
  for each row execute function public.set_updated_at();

alter table public.import_runs enable row level security;
alter table public.import_run_outputs enable row level security;
alter table public.import_candidates enable row level security;
alter table public.import_candidate_validations enable row level security;
alter table public.import_candidate_render_validations enable row level security;

create policy import_runs_admin_select on public.import_runs
  for select to authenticated
  using ((select public.current_user_has_permission('admin.manage_imports')));

create policy import_run_outputs_admin_select on public.import_run_outputs
  for select to authenticated
  using ((select public.current_user_has_permission('admin.manage_imports')));

create policy import_candidates_admin_select on public.import_candidates
  for select to authenticated
  using ((select public.current_user_has_permission('admin.manage_imports')));

create policy import_candidate_validations_admin_select on public.import_candidate_validations
  for select to authenticated
  using ((select public.current_user_has_permission('admin.manage_imports')));

create policy import_candidate_render_validations_admin_select
  on public.import_candidate_render_validations
  for select to authenticated
  using ((select public.current_user_has_permission('admin.manage_imports')));

drop policy if exists catalogue_items_select_anyone on public.catalogue_items;
create policy catalogue_items_select_listed_anon on public.catalogue_items
  for select to anon
  using (is_listed);

create policy catalogue_items_select_listed_or_admin on public.catalogue_items
  for select to authenticated
  using (
    is_listed
    or (select public.current_user_has_permission('admin.manage_catalogue'))
  );

-- Browser clients may manage legacy spreadsheet imports directly, but video
-- imports are an immutable state machine whose pointers and status are changed
-- only by the guarded functions below.
drop policy if exists import_jobs_admin_insert on public.import_jobs;
create policy import_jobs_admin_insert on public.import_jobs
  for insert to authenticated
  with check (
    (select public.current_user_has_permission('admin.manage_imports'))
    and kind <> 'firework_video'
  );

drop policy if exists import_jobs_admin_update on public.import_jobs;
create policy import_jobs_admin_update on public.import_jobs
  for update to authenticated
  using (
    (select public.current_user_has_permission('admin.manage_imports'))
    and kind <> 'firework_video'
  )
  with check (
    (select public.current_user_has_permission('admin.manage_imports'))
    and kind <> 'firework_video'
  );

drop policy if exists import_jobs_admin_delete on public.import_jobs;
create policy import_jobs_admin_delete on public.import_jobs
  for delete to authenticated
  using (
    (select public.current_user_has_permission('admin.manage_imports'))
    and kind <> 'firework_video'
  );

drop policy if exists media_assets_admin_update on public.media_assets;
create policy media_assets_admin_update on public.media_assets
  for update to authenticated
  using (
    (select public.current_user_has_permission('admin.manage_imports'))
    and not exists (
      select 1
      from public.import_jobs job
      where job.media_asset_id = media_assets.id
        and job.kind = 'firework_video'
    )
  )
  with check (
    (select public.current_user_has_permission('admin.manage_imports'))
    and not exists (
      select 1
      from public.import_jobs job
      where job.media_asset_id = media_assets.id
        and job.kind = 'firework_video'
    )
  );

drop policy if exists media_assets_admin_delete on public.media_assets;
create policy media_assets_admin_delete on public.media_assets
  for delete to authenticated
  using (
    (select public.current_user_has_permission('admin.manage_imports'))
    and not exists (
      select 1
      from public.import_jobs job
      where job.media_asset_id = media_assets.id
        and job.kind = 'firework_video'
    )
  );

drop policy if exists "import_videos_admin_update" on storage.objects;
create policy "import_videos_admin_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'import-videos'
    and (select public.current_user_has_permission('admin.manage_imports'))
    and name like (select auth.uid())::text || '/%'
    and not exists (
      select 1
      from public.media_assets asset
      join public.import_jobs job on job.media_asset_id = asset.id
      where asset.storage_path = storage.objects.name
        and job.kind = 'firework_video'
    )
    and not exists (
      select 1
      from public.import_run_outputs output
      where output.storage_path = storage.objects.name
    )
  )
  with check (
    bucket_id = 'import-videos'
    and (select public.current_user_has_permission('admin.manage_imports'))
    and name like (select auth.uid())::text || '/%'
    and not exists (
      select 1
      from public.media_assets asset
      join public.import_jobs job on job.media_asset_id = asset.id
      where asset.storage_path = storage.objects.name
        and job.kind = 'firework_video'
    )
    and not exists (
      select 1
      from public.import_run_outputs output
      where output.storage_path = storage.objects.name
    )
  );

drop policy if exists "import_videos_admin_delete" on storage.objects;
create policy "import_videos_admin_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'import-videos'
    and (select public.current_user_has_permission('admin.manage_imports'))
    and name like (select auth.uid())::text || '/%'
    and not exists (
      select 1
      from public.media_assets asset
      join public.import_jobs job on job.media_asset_id = asset.id
      where asset.storage_path = storage.objects.name
        and job.kind = 'firework_video'
    )
    and not exists (
      select 1
      from public.import_run_outputs output
      where output.storage_path = storage.objects.name
    )
  );

drop policy if exists "import_videos_admin_insert" on storage.objects;
create policy "import_videos_admin_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'import-videos'
    and (select public.current_user_has_permission('admin.manage_imports'))
    and name like (select auth.uid())::text || '/%'
  );

drop policy if exists "import_videos_admin_read" on storage.objects;
create policy "import_videos_admin_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'import-videos'
    and (select public.current_user_has_permission('admin.manage_imports'))
    and (
      name like (select auth.uid())::text || '/%'
      or exists (
        select 1
        from public.media_assets asset
        join public.import_jobs job on job.media_asset_id = asset.id
        where asset.storage_path = storage.objects.name
          and job.kind = 'firework_video'
      )
      or exists (
        select 1
        from public.import_run_outputs output
        where output.storage_path = storage.objects.name
      )
    )
  );

grant select on public.import_runs, public.import_run_outputs, public.import_candidates,
  public.import_candidate_validations, public.import_candidate_render_validations
  to authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.import_runs, public.import_run_outputs, public.import_candidates,
  public.import_candidate_validations, public.import_candidate_render_validations
  from service_role;
grant select on public.import_runs, public.import_run_outputs, public.import_candidates,
  public.import_candidate_validations, public.import_candidate_render_validations
  to service_role;

-- Import runs share one reservation across bounded automatic lease recovery.
-- Resolution is kept private because workers must not be able to debit or
-- refund arbitrary users or reservation keys.
create or replace function private.resolve_firework_import_credit(
  p_run_id uuid,
  p_outcome text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_row public.import_runs;
  reservation_row public.ai_credit_transactions;
  account_row public.ai_credit_accounts;
  resolution_type text;
  resolution_status text;
  resolution_key text;
begin
  if p_outcome not in ('settled', 'refunded') then
    raise exception 'Invalid import credit outcome.' using errcode = '22023';
  end if;

  select run.* into run_row
  from public.import_runs run
  where run.id = p_run_id
  for update;
  if not found then
    raise exception 'Reconstruction run not found.' using errcode = 'P0002';
  end if;
  if run_row.credit_reservation_key is null or run_row.credit_status is null then
    raise exception 'The reconstruction run has no credit reservation.' using errcode = '55000';
  end if;
  if run_row.credit_status = p_outcome then
    return;
  end if;
  if run_row.credit_status <> 'reserved' then
    raise exception 'The reconstruction credit reservation was already resolved differently.'
      using errcode = '55000';
  end if;
  if run_row.created_by is null then
    -- Auth deletion cascades the account and ledger transaction, so there is
    -- no remaining reservation to mutate or charge.
    update public.import_runs
    set credit_status = 'refunded'
    where credit_reservation_key = run_row.credit_reservation_key
      and credit_status = 'reserved';
    return;
  end if;

  select transaction.* into reservation_row
  from public.ai_credit_transactions transaction
  where transaction.idempotency_key = run_row.credit_reservation_key
    and transaction.user_id = run_row.created_by
    and transaction.transaction_type = 'reserve'
    and transaction.reference_type = 'import_run'
  for update;
  if not found then
    raise exception 'The reconstruction credit reservation was not found.' using errcode = '55000';
  end if;

  if reservation_row.status = p_outcome then
    update public.import_runs
    set credit_status = p_outcome
    where credit_reservation_key = run_row.credit_reservation_key
      and credit_status = 'reserved';
    return;
  end if;
  if reservation_row.status <> 'reserved' then
    raise exception 'The reconstruction credit reservation was already resolved differently.'
      using errcode = '55000';
  end if;

  select account.* into account_row
  from public.ai_credit_accounts account
  where account.user_id = run_row.created_by
  for update;
  if not found then
    raise exception 'The reconstruction credit account was not found.' using errcode = '55000';
  end if;

  if p_outcome = 'settled' then
    update public.ai_credit_accounts
    set reserved = reserved - reservation_row.amount,
        balance = balance - reservation_row.amount
    where user_id = run_row.created_by
      and reserved >= reservation_row.amount
      and balance >= reservation_row.amount
    returning * into account_row;
    resolution_type := 'debit';
    resolution_status := 'applied';
    resolution_key := run_row.credit_reservation_key || ':debit';
  else
    update public.ai_credit_accounts
    set reserved = reserved - reservation_row.amount
    where user_id = run_row.created_by
      and reserved >= reservation_row.amount
    returning * into account_row;
    resolution_type := 'refund';
    resolution_status := 'applied';
    resolution_key := run_row.credit_reservation_key || ':refund';
  end if;
  if not found then
    raise exception 'The reconstruction credit reservation could not be resolved.' using errcode = '55000';
  end if;

  update public.ai_credit_transactions
  set status = p_outcome,
      balance_after = account_row.balance,
      reserved_after = account_row.reserved
  where id = reservation_row.id;

  insert into public.ai_credit_transactions (
    user_id,
    transaction_type,
    status,
    action_key,
    amount,
    balance_after,
    reserved_after,
    reference_type,
    reference_id,
    idempotency_key,
    related_transaction_id,
    metadata,
    created_by
  ) values (
    run_row.created_by,
    resolution_type,
    resolution_status,
    reservation_row.action_key,
    reservation_row.amount,
    account_row.balance,
    account_row.reserved,
    reservation_row.reference_type,
    reservation_row.reference_id,
    resolution_key,
    reservation_row.id,
    jsonb_build_object(
      'reason', left(coalesce(nullif(btrim(p_reason), ''), 'Import reconstruction resolved'), 500),
      'importRunId', p_run_id
    ),
    run_row.created_by
  );

  update public.import_runs
  set credit_status = p_outcome
  where credit_reservation_key = run_row.credit_reservation_key
    and credit_status = 'reserved';
end;
$$;

revoke execute on function private.resolve_firework_import_credit(uuid, text, text)
  from public, anon, authenticated, service_role;

comment on table public.import_runs is
  'Immutable processing attempts for a firework video import. Lease fields prevent stale workers from winning.';
comment on table public.import_run_outputs is
  'Append-only evidence and processing artefacts produced by one reconstruction run.';
comment on table public.import_candidates is
  'Immutable renderer-native reconstruction candidates, including scores and validation evidence.';
comment on table public.import_candidate_validations is
  'Immutable canonical renderer validation seals produced by the trusted application validator.';
comment on table public.import_candidate_render_validations is
  'Immutable publication seals for exact FireworksEngine comparison evidence and its retained review artefact.';

-- Finalise the browser's direct storage upload and create its first run in one
-- database transaction. Storage metadata, not browser-reported size or MIME,
-- is authoritative at this boundary.
create or replace function public.finalise_firework_video_import(
  p_source_name text,
  p_storage_path text,
  p_original_name text,
  p_selected_model text,
  p_reported_duration_seconds numeric default null
)
returns table (job_id uuid, run_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  storage_metadata jsonb;
  storage_mime text;
  storage_size bigint;
  media_id uuid;
  existing_job_id uuid;
  existing_run_id uuid;
  existing_archived_at timestamptz;
  existing_owner_id uuid;
  existing_source_name text;
  existing_model text;
  existing_duration numeric;
  existing_original_name text;
  active_run_count integer;
  credit_amount integer;
  credit_result jsonb;
  reservation_key text;
begin
  if caller_id is null
    or not public.current_user_has_permission('admin.manage_imports') then
    raise exception 'You do not have permission to manage imports.'
      using errcode = '42501';
  end if;

  if p_source_name is null
    or p_storage_path is null
    or p_original_name is null
    or p_selected_model is null
    or char_length(btrim(p_source_name)) not between 1 and 180
    or char_length(btrim(p_original_name)) not between 1 and 255
    or btrim(p_selected_model) not in (
      'openai/gpt-5.4',
      'openai/gpt-5.4-mini',
      'google/gemini-2.5-pro'
    ) then
    raise exception 'Invalid import metadata.' using errcode = '22023';
  end if;

  if p_storage_path !~ ('^' || caller_id::text || '/[^/]+$') then
    raise exception 'The uploaded object is outside your admin folder.'
      using errcode = '42501';
  end if;

  -- Serialise the per-user cap before taking storage or job row locks. This
  -- makes two simultaneous uploads observe each other's queued run.
  perform pg_advisory_xact_lock(
    hashtextextended('firework-import-user:' || caller_id::text, 0)
  );

  select object.metadata
  into storage_metadata
  from storage.objects object
  where object.bucket_id = 'import-videos'
    and object.name = p_storage_path
  for update;

  if not found then
    raise exception 'The uploaded video was not found.' using errcode = 'P0002';
  end if;

  storage_mime := coalesce(nullif(storage_metadata ->> 'mimetype', ''), 'application/octet-stream');
  storage_size := nullif(storage_metadata ->> 'size', '')::bigint;
  if storage_mime not in ('video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska') then
    raise exception 'The uploaded object is not a supported video.' using errcode = '22023';
  end if;
  if storage_size is null or storage_size < 1 or storage_size > 262144000 then
    raise exception 'The uploaded video exceeds the 250 MB limit.' using errcode = '22023';
  end if;
  if p_reported_duration_seconds is not null
    and p_reported_duration_seconds not between 0 and 60 then
    raise exception 'The video duration must be at most 60 seconds.' using errcode = '22023';
  end if;

  select
    asset.id,
    asset.owner_id,
    nullif(asset.metadata ->> 'reportedDurationSeconds', '')::numeric,
    asset.metadata ->> 'originalName',
    job.id,
    job.active_run_id,
    job.archived_at,
    job.source_name,
    job.selected_model
  into
    media_id,
    existing_owner_id,
    existing_duration,
    existing_original_name,
    existing_job_id,
    existing_run_id,
    existing_archived_at,
    existing_source_name,
    existing_model
  from public.media_assets asset
  left join public.import_jobs job
    on job.media_asset_id = asset.id
   and job.kind = 'firework_video'
  where asset.storage_path = p_storage_path
  limit 1;

  if media_id is not null then
    if existing_owner_id is distinct from caller_id then
      raise exception 'The uploaded video belongs to another user.' using errcode = '42501';
    end if;
    if existing_duration is distinct from p_reported_duration_seconds
      or existing_original_name is distinct from btrim(p_original_name) then
      raise exception 'This upload path was finalised with different media metadata.'
        using errcode = '22023';
    end if;
  end if;

  if existing_job_id is not null then
    if existing_archived_at is not null then
      raise exception 'This uploaded video belongs to an archived import.' using errcode = '55000';
    end if;
    if existing_source_name is distinct from btrim(p_source_name)
      or existing_model is distinct from btrim(p_selected_model) then
      raise exception 'This upload path belongs to a different reconstruction request.'
        using errcode = '22023';
    end if;
    return query select existing_job_id, existing_run_id;
    return;
  end if;

  select count(*)::integer into active_run_count
  from public.import_runs run
  where run.created_by = caller_id
    and run.status in ('queued', 'processing');
  if active_run_count >= 2 then
    raise exception 'You already have two active firework reconstructions. Wait for one to finish.'
      using errcode = '55000';
  end if;

  if media_id is null then
    insert into public.media_assets (
      owner_id,
      source_type,
      storage_path,
      mime_type,
      duration_seconds,
      metadata
    ) values (
      caller_id,
      'upload',
      p_storage_path,
      storage_mime,
      p_reported_duration_seconds,
      jsonb_build_object(
        'originalName', btrim(p_original_name),
        'sizeBytes', storage_size,
        'verifiedFromStorage', true,
        'reportedDurationSeconds', p_reported_duration_seconds
      )
    )
    returning id into media_id;
  end if;

  insert into public.import_jobs (
    created_by,
    kind,
    status,
    source_name,
    media_asset_id,
    row_count,
    selected_model,
    processing_progress
  ) values (
    caller_id,
    'firework_video',
    'queued',
    btrim(p_source_name),
    media_id,
    0,
    btrim(p_selected_model),
    0
  )
  returning id into job_id;

  insert into public.import_runs (
    import_job_id,
    created_by,
    request_kind,
    attempt_number,
    idempotency_key,
    selected_model
  ) values (
    job_id,
    caller_id,
    'initial',
    1,
    'upload:' || p_storage_path,
    btrim(p_selected_model)
  )
  returning id into run_id;

  reservation_key := 'firework-import:' || run_id::text || ':reserve';
  select cost.amount into credit_amount
  from public.ai_credit_costs cost
  where cost.key = 'import_video_reconstruction';
  if credit_amount is null or credit_amount <= 0 then
    raise exception 'The reconstruction credit cost is not configured.' using errcode = '55000';
  end if;
  credit_result := public.reserve_ai_credits(
    caller_id,
    'import_video_reconstruction',
    credit_amount,
    'import_run',
    run_id,
    reservation_key,
    jsonb_build_object('requestKind', 'initial', 'selectedModel', btrim(p_selected_model))
  );
  if not coalesce((credit_result ->> 'ok')::boolean, false) then
    raise exception '%', coalesce(credit_result ->> 'error', 'Could not reserve reconstruction credits.')
      using errcode = '55000';
  end if;

  update public.import_runs
  set credit_action_key = 'import_video_reconstruction',
      credit_reservation_key = reservation_key,
      credit_status = 'reserved'
  where id = run_id;

  update public.import_jobs
  set active_run_id = run_id
  where id = job_id;

  return next;
end;
$$;

revoke execute on function public.finalise_firework_video_import(text, text, text, text, numeric)
  from public, anon;
grant execute on function public.finalise_firework_video_import(text, text, text, text, numeric)
  to authenticated;

-- Start a retry or refinement only after the prior attempt has reached a
-- terminal state. The idempotency key makes repeated form submissions safe.
create or replace function public.start_firework_import_run(
  p_job_id uuid,
  p_request_kind text,
  p_selected_model text,
  p_idempotency_key text,
  p_request_prompt text default null
)
returns public.import_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_job public.import_jobs;
  active_run public.import_runs;
  existing_run public.import_runs;
  created_run public.import_runs;
  next_attempt integer;
  active_run_count integer;
  credit_action text;
  credit_amount integer;
  credit_result jsonb;
  reservation_key text;
begin
  if caller_id is null
    or not public.current_user_has_permission('admin.manage_imports') then
    raise exception 'You do not have permission to manage imports.'
      using errcode = '42501';
  end if;

  if p_request_kind is null
    or p_selected_model is null
    or p_idempotency_key is null
    or p_request_kind not in ('retry', 'refinement')
    or btrim(p_selected_model) not in (
      'openai/gpt-5.4',
      'openai/gpt-5.4-mini',
      'google/gemini-2.5-pro'
    )
    or char_length(btrim(p_idempotency_key)) not between 8 and 240
    or char_length(coalesce(p_request_prompt, '')) > 4000
    or (p_request_kind = 'refinement' and char_length(btrim(coalesce(p_request_prompt, ''))) < 3) then
    raise exception 'Invalid reconstruction request.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('firework-import-user:' || caller_id::text, 0)
  );

  select * into target_job
  from public.import_jobs
  where id = p_job_id
  for update;
  if not found or target_job.kind <> 'firework_video' or target_job.archived_at is not null then
    raise exception 'Active firework video import not found.' using errcode = 'P0002';
  end if;

  select * into existing_run
  from public.import_runs
  where idempotency_key = p_idempotency_key;
  if found then
    if existing_run.import_job_id <> p_job_id
      or existing_run.request_kind <> p_request_kind
      or existing_run.selected_model <> btrim(p_selected_model)
      or existing_run.request_prompt is distinct from nullif(btrim(coalesce(p_request_prompt, '')), '') then
      raise exception 'The idempotency key belongs to a different reconstruction request.'
        using errcode = '22023';
    end if;
    return existing_run;
  end if;

  if target_job.status = 'complete' or target_job.approved_catalogue_item_id is not null then
    raise exception 'An approved import cannot be queued again.' using errcode = '55000';
  end if;

  if target_job.active_run_id is not null then
    select * into active_run
    from public.import_runs
    where id = target_job.active_run_id
    for update;
    if active_run.status in ('queued', 'processing') then
      raise exception 'This import already has an active reconstruction run.' using errcode = '55000';
    end if;
  end if;

  if p_request_kind = 'refinement' and target_job.selected_candidate_id is null then
    raise exception 'Select a reconstruction candidate before refining it.' using errcode = '55000';
  end if;

  select count(*)::integer into active_run_count
  from public.import_runs run
  where run.created_by = caller_id
    and run.status in ('queued', 'processing');
  if active_run_count >= 2 then
    raise exception 'You already have two active firework reconstructions. Wait for one to finish.'
      using errcode = '55000';
  end if;

  select coalesce(max(run.attempt_number), 0) + 1
  into next_attempt
  from public.import_runs run
  where run.import_job_id = p_job_id;

  insert into public.import_runs (
    import_job_id,
    parent_run_id,
    source_candidate_id,
    created_by,
    request_kind,
    request_prompt,
    attempt_number,
    idempotency_key,
    selected_model
  ) values (
    p_job_id,
    target_job.active_run_id,
    case when p_request_kind = 'refinement' then target_job.selected_candidate_id else null end,
    caller_id,
    p_request_kind,
    nullif(btrim(coalesce(p_request_prompt, '')), ''),
    next_attempt,
    btrim(p_idempotency_key),
    btrim(p_selected_model)
  )
  returning * into created_run;

  credit_action := case
    when p_request_kind = 'refinement' then 'import_video_refinement'
    else 'import_video_reconstruction'
  end;
  reservation_key := 'firework-import:' || created_run.id::text || ':reserve';
  select cost.amount into credit_amount
  from public.ai_credit_costs cost
  where cost.key = credit_action;
  if credit_amount is null or credit_amount <= 0 then
    raise exception 'The reconstruction credit cost is not configured.' using errcode = '55000';
  end if;
  credit_result := public.reserve_ai_credits(
    caller_id,
    credit_action,
    credit_amount,
    'import_run',
    created_run.id,
    reservation_key,
    jsonb_build_object(
      'requestKind', p_request_kind,
      'selectedModel', btrim(p_selected_model),
      'sourceCandidateId', created_run.source_candidate_id
    )
  );
  if not coalesce((credit_result ->> 'ok')::boolean, false) then
    raise exception '%', coalesce(credit_result ->> 'error', 'Could not reserve reconstruction credits.')
      using errcode = '55000';
  end if;

  update public.import_runs
  set credit_action_key = credit_action,
      credit_reservation_key = reservation_key,
      credit_status = 'reserved'
  where id = created_run.id
  returning * into created_run;

  update public.import_jobs
  set active_run_id = created_run.id,
      selected_model = created_run.selected_model,
      status = 'queued',
      processing_progress = 0,
      error_message = null,
      started_at = null,
      completed_at = null
  where id = p_job_id;

  return created_run;
end;
$$;

revoke execute on function public.start_firework_import_run(uuid, text, text, text, text)
  from public, anon;
grant execute on function public.start_firework_import_run(uuid, text, text, text, text)
  to authenticated;

-- Archival retains the source, evidence and candidate history for audit while
-- atomically revoking any queued or in-flight worker lease. Video imports are
-- never hard-deleted through browser-facing table privileges.
create or replace function public.archive_firework_import_job(p_job_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_row public.import_jobs;
  active_run public.import_runs;
begin
  if auth.uid() is null
    or not public.current_user_has_permission('admin.manage_imports') then
    raise exception 'Import administration permission is required.' using errcode = '42501';
  end if;

  select job.* into job_row
  from public.import_jobs job
  where job.id = p_job_id
  for update;
  if not found or job_row.kind <> 'firework_video' then
    raise exception 'Firework video import not found.' using errcode = 'P0002';
  end if;
  if job_row.archived_at is not null then
    return job_row.id;
  end if;

  if job_row.active_run_id is not null then
    select run.* into active_run
    from public.import_runs run
    where run.id = job_row.active_run_id
    for update;

    if found and active_run.status in ('queued', 'processing') then
      perform private.resolve_firework_import_credit(
        active_run.id,
        'refunded',
        'Firework import archived before reconstruction completed'
      );

      update public.import_runs
      set status = 'superseded',
          stage = 'archived',
          lease_token = null,
          lease_expires_at = null,
          heartbeat_at = now(),
          completed_at = now(),
          error_message = 'The import was archived by an administrator.'
      where id = active_run.id;

      job_row.status := 'failed';
    end if;
  end if;

  update public.import_jobs
  set archived_at = now(),
      archived_by = auth.uid(),
      active_run_id = case
        when active_run.status in ('queued', 'processing') then null
        else active_run_id
      end,
      status = job_row.status,
      error_message = case
        when active_run.status in ('queued', 'processing')
          then 'The import was archived by an administrator.'
        else error_message
      end,
      completed_at = case
        when active_run.status in ('queued', 'processing') then now()
        else completed_at
      end
  where id = job_row.id;

  return job_row.id;
end;
$$;

revoke execute on function public.archive_firework_import_job(uuid)
  from public, anon;
grant execute on function public.archive_firework_import_job(uuid)
  to authenticated;

-- Workers claim a queued run with SKIP LOCKED and receive only the source
-- record required for that run. Subsequent writes must present the lease token.
create or replace function public.claim_firework_import_run(
  p_processor_version text,
  p_requested_run_id uuid default null,
  p_lease_seconds integer default 900
)
returns table (
  run_id uuid,
  job_id uuid,
  lease_token uuid,
  storage_path text,
  source_name text,
  selected_model text,
  request_kind text,
  request_prompt text,
  parent_candidate jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_job public.import_jobs;
  claimed_run public.import_runs;
  expired_job public.import_jobs;
  expired_run public.import_runs;
  recovery_run public.import_runs;
  claimed_lease uuid := gen_random_uuid();
  claim_target_run_id uuid := p_requested_run_id;
  next_attempt integer;
  recovery_count integer;
  changed_rows integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only the import worker can claim reconstruction runs.'
      using errcode = '42501';
  end if;
  if char_length(btrim(p_processor_version)) not between 1 and 120
    or p_lease_seconds not between 60 and 3600 then
    raise exception 'Invalid worker claim.' using errcode = '22023';
  end if;

  -- A crashed container must not strand an import in processing forever. The
  -- next direct dispatch or scheduled sweep closes the expired attempt and
  -- creates a bounded, immutable recovery attempt before claiming it.
  select job.* into expired_job
  from public.import_jobs job
  join public.import_runs run on run.id = job.active_run_id
  join public.media_assets asset on asset.id = job.media_asset_id
  where run.status = 'processing'
    and run.lease_expires_at <= now()
    and job.active_run_id = run.id
    and job.kind = 'firework_video'
    and job.status = 'processing'
    and job.archived_at is null
    and nullif(btrim(coalesce(asset.storage_path, '')), '') is not null
    and coalesce(asset.mime_type, '') like 'video/%'
    and (p_requested_run_id is null or run.id = p_requested_run_id)
  order by run.created_at
  for update of job skip locked
  limit 1;

  if found then
    select run.* into expired_run
    from public.import_runs run
    where run.id = expired_job.active_run_id
      and run.status = 'processing'
      and run.lease_expires_at <= now()
    for update;
  end if;

  if found and expired_run.id is not null then
    recovery_count := expired_run.lease_recovery_count;

    update public.import_runs
    set status = 'failed',
        stage = 'lease_expired',
        lease_token = null,
        lease_expires_at = null,
        heartbeat_at = now(),
        completed_at = now(),
        error_message = 'The worker lease expired before completion.'
    where id = expired_run.id;

    if recovery_count < 2 then
      select coalesce(max(run.attempt_number), 0) + 1
      into next_attempt
      from public.import_runs run
      where run.import_job_id = expired_run.import_job_id;

      insert into public.import_runs (
        import_job_id,
        parent_run_id,
        source_candidate_id,
        created_by,
        request_kind,
        request_prompt,
        attempt_number,
        idempotency_key,
        selected_model,
        lease_recovery_count,
        credit_action_key,
        credit_reservation_key,
        credit_status
      ) values (
        expired_run.import_job_id,
        expired_run.id,
        expired_run.source_candidate_id,
        expired_run.created_by,
        case when expired_run.request_kind = 'refinement' then 'refinement' else 'retry' end,
        expired_run.request_prompt,
        next_attempt,
        'lease-recovery:' || expired_run.id::text,
        expired_run.selected_model,
        recovery_count + 1,
        expired_run.credit_action_key,
        expired_run.credit_reservation_key,
        expired_run.credit_status
      )
      returning * into recovery_run;

      update public.import_jobs
      set active_run_id = recovery_run.id,
          status = 'queued',
          processing_progress = 0,
          processor_version = null,
          error_message = null,
          started_at = null,
          completed_at = null
      where id = expired_run.import_job_id
        and active_run_id = expired_run.id;
      claim_target_run_id := recovery_run.id;
    else
      perform private.resolve_firework_import_credit(
        expired_run.id,
        'refunded',
        'Reconstruction stopped after repeated worker lease expiry'
      );

      update public.import_jobs
      set status = 'failed',
          error_message = 'Reconstruction stopped after repeated worker lease expiry.',
          completed_at = now()
      where id = expired_run.import_job_id
        and active_run_id = expired_run.id;
    end if;
  end if;

  select job.* into claimed_job
  from public.import_jobs job
  join public.import_runs run on run.id = job.active_run_id
  join public.media_assets asset on asset.id = job.media_asset_id
  where run.status = 'queued'
    and job.active_run_id = run.id
    and job.kind = 'firework_video'
    and job.status = 'queued'
    and job.archived_at is null
    and nullif(btrim(coalesce(asset.storage_path, '')), '') is not null
    and coalesce(asset.mime_type, '') like 'video/%'
    and (claim_target_run_id is null or run.id = claim_target_run_id)
  order by run.created_at
  for update of job skip locked
  limit 1;

  if not found then return; end if;

  select run.* into claimed_run
  from public.import_runs run
  where run.id = claimed_job.active_run_id
    and run.status = 'queued'
  for update;
  if not found then return; end if;

  update public.import_runs
  set status = 'processing',
      stage = 'probe',
      progress = 1,
      lease_token = claimed_lease,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      heartbeat_at = now(),
      started_at = coalesce(started_at, now()),
      error_message = null
  where id = claimed_run.id;

  update public.import_jobs
  set status = 'processing',
      processing_progress = 1,
      processor_version = btrim(p_processor_version),
      started_at = coalesce(started_at, now()),
      error_message = null
  where id = claimed_run.import_job_id
    and active_run_id = claimed_run.id;
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'The reconstruction job is no longer claimable.' using errcode = '55000';
  end if;

  return query
  select
    claimed_run.id,
    job.id,
    claimed_lease,
    asset.storage_path,
    job.source_name,
    claimed_run.selected_model,
    claimed_run.request_kind,
    claimed_run.request_prompt,
    candidate.reconstruction
  from public.import_jobs job
  join public.media_assets asset on asset.id = job.media_asset_id
  left join public.import_candidates candidate on candidate.id = claimed_run.source_candidate_id
  where job.id = claimed_run.import_job_id;
end;
$$;

revoke execute on function public.claim_firework_import_run(text, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.claim_firework_import_run(text, uuid, integer)
  to service_role;

-- Every lease mutation locks the parent job before its active run. Keeping one
-- lock order across retries, archival and worker callbacks prevents avoidable
-- deadlocks when a completion races an administrator action.
create or replace function public.lock_firework_import_lease(
  p_run_id uuid,
  p_lease_token uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  locked_job_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only the import worker can lock reconstruction leases.' using errcode = '42501';
  end if;

  select job.id into locked_job_id
  from public.import_jobs job
  join public.import_runs run on run.import_job_id = job.id
  where run.id = p_run_id
    and run.lease_token = p_lease_token
    and run.status = 'processing'
    and run.lease_expires_at > now()
    and job.active_run_id = run.id
    and job.archived_at is null
  for update of job;
  if locked_job_id is null then
    raise exception 'The reconstruction lease is stale.' using errcode = '55000';
  end if;

  perform 1
  from public.import_runs run
  where run.id = p_run_id
    and run.lease_token = p_lease_token
    and run.status = 'processing'
    and run.lease_expires_at > now()
  for update;
  if not found then
    raise exception 'The reconstruction lease is stale.' using errcode = '55000';
  end if;

  return locked_job_id;
end;
$$;

revoke execute on function public.lock_firework_import_lease(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.lock_firework_import_lease(uuid, uuid)
  to service_role;

create or replace function public.heartbeat_firework_import_run(
  p_run_id uuid,
  p_lease_token uuid,
  p_stage text,
  p_progress integer,
  p_lease_seconds integer default 900
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_job_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only the import worker can update reconstruction runs.' using errcode = '42501';
  end if;
  if char_length(btrim(p_stage)) not between 1 and 80
    or p_progress not between 1 and 99
    or p_lease_seconds not between 60 and 3600 then
    raise exception 'Invalid reconstruction progress.' using errcode = '22023';
  end if;

  run_job_id := public.lock_firework_import_lease(p_run_id, p_lease_token);

  update public.import_runs run
  set stage = btrim(p_stage),
      progress = greatest(run.progress, p_progress),
      heartbeat_at = now(),
      lease_expires_at = now() + make_interval(secs => p_lease_seconds)
  where run.id = p_run_id
    and run.lease_token = p_lease_token;

  update public.import_jobs job
  set processing_progress = greatest(job.processing_progress, p_progress)
  where job.id = run_job_id
    and job.active_run_id = p_run_id;
end;
$$;

revoke execute on function public.heartbeat_firework_import_run(uuid, uuid, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.heartbeat_firework_import_run(uuid, uuid, text, integer, integer)
  to service_role;

-- Media probe facts are shared by the review UI, so stale workers must not
-- update them directly after losing their lease. Normalised previews are
-- accepted only after the append-only run output has fenced that exact path.
create or replace function public.record_firework_import_media_probe(
  p_run_id uuid,
  p_lease_token uuid,
  p_duration_seconds numeric,
  p_width integer,
  p_height integer,
  p_source_probe jsonb,
  p_normalized_preview jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_job_id uuid;
  media_row public.media_assets;
  normalised_path text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only the import worker can record media probe data.' using errcode = '42501';
  end if;
  if p_duration_seconds not between 0.01 and 60
    or p_width not between 1 and 16384
    or p_height not between 1 and 16384
    or jsonb_typeof(p_source_probe) is distinct from 'object'
    or (
      p_normalized_preview is not null
      and jsonb_typeof(p_normalized_preview) is distinct from 'object'
    ) then
    raise exception 'Invalid reconstruction media probe.' using errcode = '22023';
  end if;

  run_job_id := public.lock_firework_import_lease(p_run_id, p_lease_token);

  select asset.* into media_row
  from public.import_jobs job
  join public.media_assets asset on asset.id = job.media_asset_id
  where job.id = run_job_id
    and job.kind = 'firework_video'
  for update of asset;
  if not found then
    raise exception 'The reconstruction media asset was not found.' using errcode = 'P0002';
  end if;

  if p_normalized_preview is not null then
    normalised_path := nullif(btrim(p_normalized_preview ->> 'storagePath'), '');
    if normalised_path is null
      or p_normalized_preview ->> 'mimeType' is distinct from 'video/mp4'
      or normalised_path not like regexp_replace(media_row.storage_path, '[^/]+$', '') || '%'
      or not exists (
        select 1
        from public.import_run_outputs output
        where output.import_run_id = p_run_id
          and output.storage_path = normalised_path
      )
      or not exists (
        select 1
        from storage.objects object
        where object.bucket_id = 'import-videos'
          and object.name = normalised_path
          and coalesce(object.metadata ->> 'mimetype', '') = 'video/mp4'
      ) then
      raise exception 'The normalised preview is not a fenced import artefact.' using errcode = '22023';
    end if;
  end if;
  if not exists (
    select 1
    from public.import_run_outputs output
    where output.import_run_id = p_run_id
      and output.output_type = 'probe'
      and output.payload -> 'source' = p_source_probe
  ) then
    raise exception 'The media probe does not match this run''s immutable probe evidence.'
      using errcode = '55000';
  end if;

  update public.media_assets
  set duration_seconds = p_duration_seconds,
      width = p_width,
      height = p_height,
      metadata = coalesce(media_row.metadata, '{}'::jsonb)
        || jsonb_build_object('sourceProbe', p_source_probe)
        || case
          when p_normalized_preview is null then '{}'::jsonb
          else jsonb_build_object('normalizedPreview', p_normalized_preview)
        end
  where id = media_row.id;

  return media_row.id;
end;
$$;

revoke execute on function public.record_firework_import_media_probe(uuid, uuid, numeric, integer, integer, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_firework_import_media_probe(uuid, uuid, numeric, integer, integer, jsonb, jsonb)
  to service_role;

create or replace function public.record_firework_import_run_context(
  p_run_id uuid,
  p_lease_token uuid,
  p_source_sha256 text,
  p_pipeline_version text,
  p_engine_schema_version text,
  p_video_model text,
  p_prompt_snapshot jsonb,
  p_model_snapshot jsonb,
  p_modal_call_id text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_job_id uuid;
  run_row public.import_runs;
  normalised_modal_call_id text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only the import worker can record reconstruction context.' using errcode = '42501';
  end if;
  if coalesce(p_source_sha256, '') !~ '^[0-9a-f]{64}$'
    or char_length(btrim(p_pipeline_version)) not between 1 and 120
    or char_length(btrim(p_engine_schema_version)) not between 1 and 120
    or char_length(btrim(p_video_model)) not between 1 and 120
    or char_length(coalesce(p_modal_call_id, '')) > 240
    or jsonb_typeof(p_prompt_snapshot) is distinct from 'object'
    or jsonb_typeof(p_model_snapshot) is distinct from 'object' then
    raise exception 'Invalid reconstruction context.' using errcode = '22023';
  end if;

  run_job_id := public.lock_firework_import_lease(p_run_id, p_lease_token);
  normalised_modal_call_id := nullif(btrim(coalesce(p_modal_call_id, '')), '');

  select run.* into run_row
  from public.import_runs run
  where run.id = p_run_id
    and run.lease_token = p_lease_token
    and run.import_job_id = run_job_id
  for update;

  if run_row.source_sha256 is not null then
    if run_row.source_sha256 is distinct from p_source_sha256
      or run_row.pipeline_version is distinct from btrim(p_pipeline_version)
      or run_row.engine_schema_version is distinct from btrim(p_engine_schema_version)
      or run_row.video_model is distinct from btrim(p_video_model)
      or run_row.prompt_snapshot is distinct from p_prompt_snapshot
      or run_row.model_snapshot is distinct from p_model_snapshot
      or run_row.modal_call_id is distinct from normalised_modal_call_id then
      raise exception 'The reconstruction context was already recorded with different provenance.'
        using errcode = '55000';
    end if;
    return;
  end if;

  update public.import_runs run
  set source_sha256 = p_source_sha256,
      pipeline_version = btrim(p_pipeline_version),
      engine_schema_version = btrim(p_engine_schema_version),
      video_model = btrim(p_video_model),
      prompt_snapshot = p_prompt_snapshot,
      model_snapshot = p_model_snapshot,
      modal_call_id = normalised_modal_call_id
  where run.id = p_run_id
    and run.lease_token = p_lease_token
    and run.import_job_id = run_job_id;
end;
$$;

revoke execute on function public.record_firework_import_run_context(uuid, uuid, text, text, text, text, jsonb, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.record_firework_import_run_context(uuid, uuid, text, text, text, text, jsonb, jsonb, text)
  to service_role;

create or replace function public.append_firework_import_run_output(
  p_run_id uuid,
  p_lease_token uuid,
  p_stage text,
  p_sequence integer,
  p_output_type text,
  p_schema_version text,
  p_payload jsonb,
  p_content_hash text default null,
  p_storage_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  output_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only the import worker can append reconstruction evidence.' using errcode = '42501';
  end if;
  if char_length(btrim(p_stage)) not between 1 and 80
    or p_sequence < 0
    or p_output_type not in (
      'probe', 'frame_observations', 'audio_observations', 'video_observations',
      'candidate_draft', 'render_metrics', 'critic_review', 'processing_log'
    )
    or char_length(btrim(p_schema_version)) not between 1 and 120
    or (p_content_hash is not null and p_content_hash !~ '^[0-9a-f]{64}$')
    or char_length(coalesce(p_storage_path, '')) > 1024 then
    raise exception 'Invalid reconstruction output.' using errcode = '22023';
  end if;

  perform public.lock_firework_import_lease(p_run_id, p_lease_token);

  insert into public.import_run_outputs (
    import_run_id,
    stage,
    sequence,
    output_type,
    schema_version,
    content_hash,
    payload,
    storage_path
  ) values (
    p_run_id,
    btrim(p_stage),
    p_sequence,
    p_output_type,
    btrim(p_schema_version),
    p_content_hash,
    p_payload,
    p_storage_path
  )
  on conflict (import_run_id, stage, sequence) do nothing
  returning id into output_id;

  if output_id is null then
    select output.id into output_id
    from public.import_run_outputs output
    where output.import_run_id = p_run_id
      and output.stage = btrim(p_stage)
      and output.sequence = p_sequence
      and output.output_type = p_output_type
      and output.schema_version = btrim(p_schema_version)
      and output.content_hash is not distinct from p_content_hash
      and output.payload = p_payload
      and output.storage_path is not distinct from p_storage_path;
    if output_id is null then
      raise exception 'A different output already occupies this stage sequence.' using errcode = '23505';
    end if;
  end if;
  return output_id;
end;
$$;

revoke execute on function public.append_firework_import_run_output(uuid, uuid, text, integer, text, text, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.append_firework_import_run_output(uuid, uuid, text, integer, text, text, jsonb, text, text)
  to service_role;

create or replace function public.complete_firework_import_run(
  p_run_id uuid,
  p_lease_token uuid,
  p_candidates jsonb,
  p_selected_ordinal integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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
      rendered_video_path,
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
      nullif(candidate_entry ->> 'renderedVideoPath', ''),
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
$$;

revoke execute on function public.complete_firework_import_run(uuid, uuid, jsonb, integer)
  from public, anon, authenticated;
grant execute on function public.complete_firework_import_run(uuid, uuid, jsonb, integer)
  to service_role;

-- Reviewers can choose any candidate from the current completed run. Candidate
-- rows remain immutable; the job owns the current selection. Invalid
-- candidates remain selectable as refinement sources, but the approval RPC
-- independently refuses them until they pass validation.
create or replace function public.select_firework_import_candidate(
  p_job_id uuid,
  p_candidate_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  job_row public.import_jobs;
  active_run_status text;
  candidate_run_status text;
  candidate_job_id uuid;
begin
  if caller_id is null
    or not public.current_user_has_permission('admin.manage_imports') then
    raise exception 'You do not have permission to manage imports.' using errcode = '42501';
  end if;

  select * into job_row
  from public.import_jobs
  where id = p_job_id
  for update;
  if not found or job_row.kind <> 'firework_video' or job_row.archived_at is not null then
    raise exception 'Active firework video import not found.' using errcode = 'P0002';
  end if;
  if job_row.approved_catalogue_item_id is not null or job_row.status = 'complete' then
    raise exception 'An approved import cannot change candidate.' using errcode = '55000';
  end if;

  if job_row.active_run_id is not null then
    select run.status into active_run_status
    from public.import_runs run
    where run.id = job_row.active_run_id
    for update;
    if active_run_status in ('queued', 'processing') then
      raise exception 'Wait for the active reconstruction run before changing candidate.'
        using errcode = '55000';
    end if;
  end if;

  select run.status, run.import_job_id into candidate_run_status, candidate_job_id
  from public.import_candidates candidate
  join public.import_runs run on run.id = candidate.import_run_id
  where candidate.id = p_candidate_id;
  if not found or candidate_run_status <> 'succeeded' or candidate_job_id <> p_job_id then
    raise exception 'The reconstruction candidate is stale or incomplete.' using errcode = '55000';
  end if;

  update public.import_jobs
  set selected_candidate_id = p_candidate_id,
      selected_by = caller_id,
      selected_at = now(),
      status = 'needs_review',
      error_message = null
  where id = p_job_id;

  return p_candidate_id;
end;
$$;

revoke execute on function public.select_firework_import_candidate(uuid, uuid)
  from public, anon;
grant execute on function public.select_firework_import_candidate(uuid, uuid)
  to authenticated;

-- The trusted Next.js action runs the current TypeScript FireworkDesignSchema,
-- expands defaults, and binds that canonical value to the immutable raw
-- candidate hash. Authenticated callers cannot create this seal or substitute
-- their own JSON.
create or replace function public.seal_firework_import_candidate(
  p_candidate_id uuid,
  p_validator_version text,
  p_canonical_reconstruction jsonb,
  p_content_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate_job_id uuid;
  candidate_row public.import_candidates;
  existing_seal public.import_candidate_validations;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only the trusted application validator can seal a candidate.' using errcode = '42501';
  end if;
  if char_length(btrim(p_validator_version)) not between 1 and 120
    or btrim(p_validator_version) is distinct from public.current_firework_import_validator_version()
    or coalesce(p_content_hash, '') !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(p_canonical_reconstruction) is distinct from 'object'
    or (p_canonical_reconstruction ->> 'version')::integer is distinct from 1
    or jsonb_typeof(p_canonical_reconstruction -> 'designs') is distinct from 'array'
    or jsonb_array_length(p_canonical_reconstruction -> 'designs') not between 1 and 64
    or jsonb_typeof(p_canonical_reconstruction -> 'shots') is distinct from 'array'
    or jsonb_array_length(p_canonical_reconstruction -> 'shots') not between 1 and 500 then
    raise exception 'The canonical reconstruction seal is malformed.' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_canonical_reconstruction -> 'designs') entry
    where jsonb_typeof(entry -> 'design') is distinct from 'object'
      or not ((entry -> 'design') ?& array[
        'colour', 'color', 'liftVelocity', 'shellLife', 'pattern', 'geometry',
        'trailProfile', 'size', 'burst', 'burstTrail', 'stars', 'launch'
      ])
      or jsonb_typeof(entry -> 'design' -> 'stars' -> 'outer') is distinct from 'object'
      or jsonb_typeof(entry -> 'design' -> 'stars' -> 'core') is distinct from 'object'
      or not ((entry -> 'design' -> 'stars' -> 'outer') ?& array[
        'enabled', 'count', 'color', 'burst', 'burstTrail'
      ])
      or not ((entry -> 'design' -> 'stars' -> 'core') ?& array[
        'enabled', 'count', 'color', 'burst', 'burstTrail'
      ])
  ) then
    raise exception 'A sealed design is not canonical renderer data.' using errcode = '22023';
  end if;

  select candidate.* into candidate_row
  from public.import_candidates candidate
  join public.import_runs run on run.id = candidate.import_run_id
  where candidate.id = p_candidate_id
    and run.status = 'succeeded'
  for share of candidate, run;
  if found then
    select run.import_job_id into candidate_job_id
    from public.import_runs run
    where run.id = candidate_row.import_run_id;
  end if;
  if candidate_job_id is null then
    raise exception 'Completed reconstruction candidate not found.' using errcode = 'P0002';
  end if;
  if candidate_row.content_hash is distinct from p_content_hash then
    raise exception 'The trusted canonical reconstruction is not bound to the immutable candidate.'
      using errcode = '55000';
  end if;

  insert into public.import_candidate_validations (
    candidate_id,
    validator_version,
    canonical_reconstruction,
    content_hash
  ) values (
    p_candidate_id,
    btrim(p_validator_version),
    p_canonical_reconstruction,
    p_content_hash
  )
  on conflict (candidate_id, validator_version) do nothing;

  select * into existing_seal
  from public.import_candidate_validations
  where candidate_id = p_candidate_id
    and validator_version = btrim(p_validator_version);
  if existing_seal.content_hash <> p_content_hash
    or existing_seal.validator_version <> btrim(p_validator_version)
    or existing_seal.canonical_reconstruction <> p_canonical_reconstruction then
    raise exception 'This candidate was already sealed with different canonical data.' using errcode = '55000';
  end if;

  return p_candidate_id;
end;
$$;

revoke execute on function public.seal_firework_import_candidate(uuid, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.seal_firework_import_candidate(uuid, text, jsonb, text)
  to service_role;

-- The trusted application also seals the exact engine comparison used for
-- publication. The evidence must already be immutable on the candidate and
-- its run-owned review video must be retained as an append-only output.
create or replace function public.seal_firework_import_render_validation(
  p_candidate_id uuid,
  p_validator_version text,
  p_canonical_evidence jsonb,
  p_artifact_storage_path text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate_row public.import_candidates;
  candidate_evidence jsonb;
  canonical_reconstruction jsonb;
  metrics jsonb;
  review_artifact jsonb;
  source_storage_path text;
  artifact_output_id uuid;
  artifact_sha256 text;
  artifact_byte_size bigint;
  artifact_storage_etag text;
  object_metadata jsonb;
  object_storage_etag text;
  computed_evidence_hash text;
  existing_seal public.import_candidate_render_validations;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only the trusted application validator can seal engine evidence.'
      using errcode = '42501';
  end if;
  if btrim(coalesce(p_validator_version, ''))
      is distinct from public.current_firework_import_render_validator_version()
    or jsonb_typeof(p_canonical_evidence) is distinct from 'object'
    or char_length(coalesce(p_artifact_storage_path, '')) not between 1 and 512 then
    raise exception 'The engine publication seal is malformed.' using errcode = '22023';
  end if;

  select candidate.*
  into candidate_row
  from public.import_candidates candidate
  join public.import_runs run on run.id = candidate.import_run_id
  where candidate.id = p_candidate_id
    and run.status = 'succeeded'
  for share of candidate;
  if not found then
    raise exception 'Completed reconstruction candidate not found.' using errcode = 'P0002';
  end if;
  select asset.storage_path into source_storage_path
  from public.import_runs run
  join public.import_jobs job on job.id = run.import_job_id
  join public.media_assets asset on asset.id = job.media_asset_id
  where run.id = candidate_row.import_run_id
    and run.status = 'succeeded'
  for share of run, job, asset;

  candidate_evidence := coalesce(
    candidate_row.metrics -> 'engineRender',
    candidate_row.metrics -> 'engine_render',
    candidate_row.metrics -> 'metrics' -> 'engineRender',
    candidate_row.metrics -> 'metrics' -> 'engine_render'
  );
  if candidate_evidence is null or candidate_evidence is distinct from p_canonical_evidence then
    raise exception 'The engine evidence does not match the immutable candidate.'
      using errcode = '55000';
  end if;

  select seal.canonical_reconstruction into canonical_reconstruction
  from public.import_candidate_validations seal
  where seal.candidate_id = p_candidate_id
    and seal.validator_version = public.current_firework_import_validator_version();
  if canonical_reconstruction is null then
    raise exception 'Seal the canonical reconstruction before its engine evidence.'
      using errcode = '55000';
  end if;

  metrics := p_canonical_evidence -> 'metrics';
  review_artifact := p_canonical_evidence -> 'reviewArtifact';
  if p_canonical_evidence ->> 'schemaVersion'
      is distinct from 'showcrafter.import-render-result.v1'
    or p_canonical_evidence ->> 'harnessVersion'
      is distinct from 'showcrafter.import-render-harness.v1'
    or p_canonical_evidence ->> 'rendererVersion'
      is distinct from public.current_firework_import_renderer_contract_version()
    or jsonb_typeof(metrics) is distinct from 'object'
    or metrics ->> 'schemaVersion' is distinct from 'showcrafter.engine-render-metrics.v2'
    or metrics -> 'engine' ->> 'renderer' is distinct from 'FireworksEngine'
    or metrics -> 'engine' ->> 'rendererVersion'
      is distinct from public.current_firework_import_renderer_contract_version()
    or metrics -> 'engine' ->> 'camera' is distinct from 'FireworkReplayCanvas.default'
    or coalesce((metrics -> 'engine' ->> 'frameCount')::integer, 0) < 8
    or coalesce((metrics -> 'engine' ->> 'frameWidth')::integer, 0) < 64
    or coalesce((metrics -> 'engine' ->> 'frameHeight')::integer, 0) < 64
    or abs(coalesce((metrics -> 'engine' ->> 'fixedStepSeconds')::numeric, 0) - (1::numeric / 60)) > 0.00000001
    or coalesce((metrics ->> 'overallScore')::numeric, 0) < 0.78
    or coalesce((metrics -> 'timing' ->> 'score')::numeric, 0) < 0.78
    or coalesce((metrics -> 'trajectory' ->> 'score')::numeric, 0) < 0.78
    or coalesce((metrics -> 'palette' ->> 'score')::numeric, 0) < 0.78
    or coalesce((metrics -> 'fade' ->> 'score')::numeric, 0) < 0.78
    or coalesce((metrics -> 'perceptual' ->> 'score')::numeric, 0) < 0.78
    or coalesce((metrics -> 'trajectory' ->> 'comparedFrameCount')::integer, 0) < 2
    or coalesce((metrics -> 'fade' ->> 'comparedFrameCount')::integer, 0) < 2
    or coalesce((metrics -> 'perceptual' ->> 'comparedFrameCount')::integer, 0) < 2
    or coalesce((metrics -> 'perceptual' ->> 'activeFrameCount')::integer, 0) < 2
    or coalesce((metrics -> 'perceptual' ->> 'foregroundWeightTotal')::numeric, 0) <= 0
    or jsonb_typeof(metrics -> 'priorityIssues') is distinct from 'array'
    or jsonb_array_length(metrics -> 'priorityIssues') <> 0
    or jsonb_typeof(p_canonical_evidence -> 'rendererDurations') is distinct from 'array'
    or jsonb_array_length(p_canonical_evidence -> 'rendererDurations')
      <> jsonb_array_length(canonical_reconstruction -> 'designs')
    or coalesce((p_canonical_evidence ->> 'requiredProductDurationSeconds')::numeric, 0) <= 0
    or (p_canonical_evidence ->> 'requiredProductDurationSeconds')::numeric
      > (canonical_reconstruction ->> 'durationSeconds')::numeric + 0.001
    or jsonb_typeof(review_artifact) is distinct from 'object'
    or review_artifact ->> 'storagePath' is distinct from p_artifact_storage_path
    or coalesce(review_artifact ->> 'sha256', '') !~ '^[0-9a-f]{64}$'
    or coalesce(review_artifact ->> 'byteSize', '') !~ '^[1-9][0-9]*$'
    or char_length(coalesce(review_artifact ->> 'byteSize', '')) > 18
    or coalesce(review_artifact ->> 'storageETag', '')
      !~ '^[0-9a-f]{32}(-[1-9][0-9]*)?$' then
    raise exception 'The engine comparison has not met every publication threshold.'
      using errcode = '22023';
  end if;
  artifact_sha256 := review_artifact ->> 'sha256';
  artifact_byte_size := (review_artifact ->> 'byteSize')::bigint;
  artifact_storage_etag := review_artifact ->> 'storageETag';
  if exists (
    select 1
    from jsonb_array_elements(p_canonical_evidence -> 'rendererDurations') duration
    left join jsonb_array_elements(canonical_reconstruction -> 'designs') design
      on design ->> 'key' = duration ->> 'designKey'
    where design is null
      or coalesce((duration ->> 'durationSeconds')::numeric, 0) <= 0
      or abs(
        (duration ->> 'durationSeconds')::numeric
        - (design ->> 'durationSeconds')::numeric
      ) > 0.002
  ) then
    raise exception 'The engine renderer durations do not match the sealed reconstruction.'
      using errcode = '22023';
  end if;

  if candidate_row.rendered_video_path is distinct from p_artifact_storage_path
    or source_storage_path is null
    or p_artifact_storage_path
      <> regexp_replace(source_storage_path, '/[^/]+$', '')
        || '/engine-review-' || candidate_row.import_run_id::text
        || '-' || substring(p_artifact_storage_path from '([0-9a-f]{16})\.mp4$') || '.mp4'
    or substring(p_artifact_storage_path from '([0-9a-f]{16})\.mp4$') is null then
    raise exception 'The engine review video is not owned by this reconstruction run.'
      using errcode = '22023';
  end if;

  select output.id into artifact_output_id
  from public.import_run_outputs output
  where output.import_run_id = candidate_row.import_run_id
    and output.output_type = 'render_metrics'
    and output.storage_path = p_artifact_storage_path
    and (
      output.payload = p_canonical_evidence
      or output.payload -> 'engineRender' = p_canonical_evidence
      or output.payload -> 'engine_render' = p_canonical_evidence
    )
  order by output.sequence desc
  limit 1;
  select object.metadata into object_metadata
  from storage.objects object
  where object.bucket_id = 'import-videos'
    and object.name = p_artifact_storage_path;
  object_storage_etag := lower(trim(both '"' from regexp_replace(
    coalesce(object_metadata ->> 'eTag', object_metadata ->> 'etag', ''),
    '^W/',
    '',
    'i'
  )));
  if artifact_output_id is null
    or object_metadata is null
    or object_metadata ->> 'mimetype' is distinct from 'video/mp4'
    or not (case
      when coalesce(object_metadata ->> 'size', '') ~ '^[1-9][0-9]*$'
        and char_length(object_metadata ->> 'size') <= 18
        then (object_metadata ->> 'size')::bigint = artifact_byte_size
      else false
    end)
    or object_storage_etag <> artifact_storage_etag then
    raise exception 'The engine review artefact has not been retained as run evidence.'
      using errcode = '55000';
  end if;

  computed_evidence_hash := private.firework_import_sha256(p_canonical_evidence::text);
  insert into public.import_candidate_render_validations (
    candidate_id,
    validator_version,
    renderer_contract_version,
    metrics_schema_version,
    canonical_evidence,
    evidence_hash,
    artifact_storage_path,
    artifact_sha256,
    artifact_byte_size,
    artifact_storage_etag,
    artifact_output_id
  ) values (
    p_candidate_id,
    btrim(p_validator_version),
    public.current_firework_import_renderer_contract_version(),
    metrics ->> 'schemaVersion',
    p_canonical_evidence,
    computed_evidence_hash,
    p_artifact_storage_path,
    artifact_sha256,
    artifact_byte_size,
    artifact_storage_etag,
    artifact_output_id
  )
  on conflict (candidate_id, validator_version) do nothing;

  select * into existing_seal
  from public.import_candidate_render_validations
  where candidate_id = p_candidate_id
    and validator_version = btrim(p_validator_version);
  if existing_seal.canonical_evidence is distinct from p_canonical_evidence
    or existing_seal.evidence_hash is distinct from computed_evidence_hash
    or existing_seal.renderer_contract_version
      is distinct from public.current_firework_import_renderer_contract_version()
    or existing_seal.artifact_storage_path is distinct from p_artifact_storage_path
    or existing_seal.artifact_sha256 is distinct from artifact_sha256
    or existing_seal.artifact_byte_size is distinct from artifact_byte_size
    or existing_seal.artifact_storage_etag is distinct from artifact_storage_etag
    or existing_seal.artifact_output_id is distinct from artifact_output_id then
    raise exception 'This candidate was already sealed with different engine evidence.'
      using errcode = '55000';
  end if;

  return p_candidate_id;
end;
$$;

revoke execute on function public.seal_firework_import_render_validation(uuid, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.seal_firework_import_render_validation(uuid, text, jsonb, text)
  to service_role;

create or replace function public.fail_firework_import_run(
  p_run_id uuid,
  p_lease_token uuid,
  p_error_message text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_job_id uuid;
  run_row public.import_runs;
  normalised_error_message text;
  request_hash text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only the import worker can fail reconstruction runs.' using errcode = '42501';
  end if;

  normalised_error_message := left(
    coalesce(nullif(btrim(p_error_message), ''), 'Reconstruction failed.'),
    2000
  );
  request_hash := private.firework_import_sha256(normalised_error_message);

  select job.id into run_job_id
  from public.import_jobs job
  join public.import_runs run on run.import_job_id = job.id
  where run.id = p_run_id
    and job.active_run_id = run.id
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

  if run_row.status = 'failed' then
    if run_row.failure_lease_token is distinct from p_lease_token
      or run_row.failure_request_hash is distinct from request_hash then
      raise exception 'This run was already failed with a different response.' using errcode = '55000';
    end if;
    return;
  end if;
  if run_row.lease_token is distinct from p_lease_token
    or run_row.status <> 'processing'
    or run_row.lease_expires_at <= now() then
    raise exception 'The reconstruction lease is stale.' using errcode = '55000';
  end if;

  perform private.resolve_firework_import_credit(
    p_run_id,
    'refunded',
    left(normalised_error_message, 500)
  );

  update public.import_runs run
  set status = 'failed',
      stage = 'failed',
      lease_token = null,
      lease_expires_at = null,
      heartbeat_at = now(),
      completed_at = now(),
      failure_request_hash = request_hash,
      failure_lease_token = p_lease_token,
      error_message = normalised_error_message
  where run.id = p_run_id
    and run.lease_token = p_lease_token;

  update public.import_jobs
  set status = 'failed',
      error_message = normalised_error_message,
      completed_at = now()
  where id = run_job_id
    and active_run_id = p_run_id;
end;
$$;

revoke execute on function public.fail_firework_import_run(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.fail_firework_import_run(uuid, uuid, text)
  to service_role;

-- Publish one strictly validated candidate. The renderer design has already
-- passed the application schema and is immutable by the time this function is
-- called. This transaction still validates ownership, effect references,
-- shot bounds and candidate provenance before creating catalogue data.
create or replace function public.approve_firework_import_candidate(
  p_job_id uuid,
  p_candidate_id uuid,
  p_part_number text,
  p_name text,
  p_manufacturer text default null,
  p_category text default null,
  p_firework_type text default null
)
returns table (catalogue_item_id uuid, firework_ids uuid[], multishot_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_row public.import_jobs;
  active_run_status text;
  candidate_row public.import_candidates;
  reconstruction jsonb;
  render_evidence jsonb;
  design_entry jsonb;
  shot_entry jsonb;
  design_key text;
  effect_slug text;
  effect_id uuid;
  firework_id uuid;
  design_ids jsonb := '{}'::jsonb;
  colours text[];
  product_duration_seconds numeric;
  duration_seconds numeric;
  scaled_single_duration_seconds numeric;
  height_meters numeric;
  calibre text;
  confidence numeric;
  shot_count integer;
  design_count integer;
  shot_index integer := 0;
  offset_seconds numeric;
  pan_degrees integer;
  tilt_degrees integer;
  shot_scale numeric;
  position_override jsonb;
  generated_multishot_id uuid;
  generated_catalogue_item_id uuid;
  generated_firework_ids uuid[] := '{}'::uuid[];
  computed_approval_request_hash text;
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

  select * into job_row
  from public.import_jobs
  where id = p_job_id
  for update;
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
    if not exists (
      select 1
      from public.import_candidate_render_validations render_seal
      join storage.objects object
        on object.bucket_id = 'import-videos'
        and object.name = render_seal.artifact_storage_path
      where render_seal.candidate_id = p_candidate_id
        and render_seal.validator_version
          = public.current_firework_import_render_validator_version()
        and render_seal.renderer_contract_version
          = public.current_firework_import_renderer_contract_version()
        and render_seal.canonical_evidence -> 'reviewArtifact' ->> 'sha256'
          = render_seal.artifact_sha256
        and render_seal.canonical_evidence -> 'reviewArtifact' ->> 'byteSize'
          = render_seal.artifact_byte_size::text
        and render_seal.canonical_evidence -> 'reviewArtifact' ->> 'storageETag'
          = render_seal.artifact_storage_etag
        and object.metadata ->> 'mimetype' = 'video/mp4'
        and (case
          when coalesce(object.metadata ->> 'size', '') ~ '^[1-9][0-9]*$'
            and char_length(object.metadata ->> 'size') <= 18
            then (object.metadata ->> 'size')::bigint = render_seal.artifact_byte_size
          else false
        end)
        and lower(trim(both '"' from regexp_replace(
          coalesce(object.metadata ->> 'eTag', object.metadata ->> 'etag', ''),
          '^W/',
          '',
          'i'
        ))) = render_seal.artifact_storage_etag
    ) then
      raise exception 'The approved engine review artefact no longer matches its immutable seal.'
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
  select render_seal.canonical_evidence into render_evidence
  from public.import_candidate_render_validations render_seal
  join storage.objects object
    on object.bucket_id = 'import-videos'
    and object.name = render_seal.artifact_storage_path
    where render_seal.candidate_id = candidate_row.id
      and render_seal.validator_version
        = public.current_firework_import_render_validator_version()
      and render_seal.renderer_contract_version
        = public.current_firework_import_renderer_contract_version()
      and render_seal.metrics_schema_version = 'showcrafter.engine-render-metrics.v2'
      and render_seal.artifact_storage_path = candidate_row.rendered_video_path
      and render_seal.canonical_evidence -> 'reviewArtifact' ->> 'sha256'
        = render_seal.artifact_sha256
      and render_seal.canonical_evidence -> 'reviewArtifact' ->> 'byteSize'
        = render_seal.artifact_byte_size::text
      and render_seal.canonical_evidence -> 'reviewArtifact' ->> 'storageETag'
        = render_seal.artifact_storage_etag
      and object.metadata ->> 'mimetype' = 'video/mp4'
      and (case
        when coalesce(object.metadata ->> 'size', '') ~ '^[1-9][0-9]*$'
          and char_length(object.metadata ->> 'size') <= 18
          then (object.metadata ->> 'size')::bigint = render_seal.artifact_byte_size
        else false
      end)
      and lower(trim(both '"' from regexp_replace(
        coalesce(object.metadata ->> 'eTag', object.metadata ->> 'etag', ''),
        '^W/',
        '',
        'i'
      ))) = render_seal.artifact_storage_etag;
  if render_evidence is null then
    raise exception 'The reconstruction candidate has not passed exact engine comparison.'
      using errcode = '55000';
  end if;
  if jsonb_typeof(reconstruction -> 'designs') is distinct from 'array'
    or jsonb_typeof(reconstruction -> 'shots') is distinct from 'array' then
    raise exception 'The reconstruction contract is malformed.' using errcode = '22023';
  end if;
  design_count := jsonb_array_length(reconstruction -> 'designs');
  shot_count := jsonb_array_length(reconstruction -> 'shots');
  product_duration_seconds := nullif(reconstruction ->> 'durationSeconds', '')::numeric;
  if design_count not between 1 and 64 or shot_count not between 1 and 500 then
    raise exception 'The reconstruction has an unsupported design or shot count.' using errcode = '22023';
  end if;
  if product_duration_seconds is null or product_duration_seconds not between 0.1 and 60 then
    raise exception 'The reconstruction duration is invalid.' using errcode = '22023';
  end if;
  if shot_count = 1 and design_count <> 1 then
    raise exception 'A single-shot reconstruction must contain one design.' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(reconstruction -> 'shots') shot
    join jsonb_array_elements(reconstruction -> 'designs') design
      on design ->> 'key' = shot ->> 'designKey'
    where nullif(shot ->> 'timeOffsetSeconds', '')::numeric
            + nullif(design ->> 'durationSeconds', '')::numeric
          > product_duration_seconds + 0.001
      or nullif(shot ->> 'observedFadeEndSeconds', '')::numeric > product_duration_seconds
      or nullif(shot ->> 'panDegrees', '')::numeric
          <> trunc(nullif(shot ->> 'panDegrees', '')::numeric)
      or nullif(shot ->> 'tiltDegrees', '')::numeric
          <> trunc(nullif(shot ->> 'tiltDegrees', '')::numeric)
  ) then
    raise exception 'A reconstructed shot is truncated or uses fractional launch angles.'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(reconstruction -> 'designs') design
    where not exists (
      select 1
      from jsonb_array_elements(reconstruction -> 'shots') shot
      where shot ->> 'designKey' = design ->> 'key'
    )
  ) then
    raise exception 'Every reconstructed design must be used by at least one shot.' using errcode = '22023';
  end if;

  for design_entry in select value from jsonb_array_elements(reconstruction -> 'designs') loop
    design_key := nullif(btrim(design_entry ->> 'key'), '');
    effect_slug := nullif(btrim(design_entry ->> 'effectSlug'), '');
    if design_key is null or char_length(design_key) > 80
      or effect_slug is null or char_length(effect_slug) > 80
      or jsonb_typeof(design_entry -> 'design') is distinct from 'object'
      or design_ids ? design_key then
      raise exception 'A reconstructed design is malformed or duplicated.' using errcode = '22023';
    end if;

    select effect.id into effect_id
    from public.firework_effects effect
    where effect.slug = effect_slug;
    if effect_id is null then
      raise exception 'Reconstructed effect % does not exist.', effect_slug using errcode = '23503';
    end if;

    select coalesce(array_agg(lower(value)), '{}'::text[])
    into colours
    from jsonb_array_elements_text(coalesce(design_entry -> 'colorPalette', '[]'::jsonb)) value
    where value ~* '^#[0-9a-f]{6}$';
    if jsonb_array_length(coalesce(design_entry -> 'colorPalette', '[]'::jsonb)) <> cardinality(colours) then
      raise exception 'A reconstructed colour palette is invalid.' using errcode = '22023';
    end if;

    duration_seconds := coalesce(
      nullif(design_entry ->> 'durationSeconds', '')::numeric,
      nullif(reconstruction ->> 'durationSeconds', '')::numeric
    );
    height_meters := nullif(design_entry ->> 'heightMeters', '')::numeric;
    calibre := nullif(btrim(design_entry ->> 'caliber'), '');
    confidence := coalesce(
      nullif(design_entry ->> 'confidence', '')::numeric,
      candidate_row.score
    );
    if duration_seconds is null or duration_seconds <= 0 or duration_seconds > 60
      or (height_meters is not null and height_meters not between 0 and 220)
      or char_length(coalesce(calibre, '')) > 40
      or confidence not between 0 and 1 then
      raise exception 'A reconstructed design contains invalid metadata.' using errcode = '22023';
    end if;

    insert into public.fireworks (
      firework_effect_id,
      slug,
      name,
      description,
      primary_color,
      secondary_color,
      color_palette,
      caliber,
      duration_seconds,
      height_meters,
      variant_json,
      render_overrides_json,
      source,
      confidence
    ) values (
      effect_id,
      'import-' || left(replace(p_job_id::text, '-', ''), 12) || '-' || left(md5(design_key), 8),
      case when design_count = 1 then btrim(p_name)
        else left(btrim(p_name) || ' - ' || coalesce(nullif(design_entry ->> 'label', ''), design_key), 180)
      end,
      nullif(btrim(reconstruction ->> 'description'), ''),
      colours[1],
      colours[2],
      colours,
      calibre,
      duration_seconds,
      height_meters,
      jsonb_build_object(
        'schemaVersion', candidate_row.schema_version,
        'importJobId', p_job_id,
        'importRunId', candidate_row.import_run_id,
        'importCandidateId', candidate_row.id,
        'designKey', design_key,
        'observations', coalesce(design_entry -> 'observations', '{}'::jsonb)
      ),
      design_entry -> 'design',
      'video_inferred',
      confidence
    )
    returning id into firework_id;

    design_ids := jsonb_set(design_ids, array[design_key], to_jsonb(firework_id::text), true);
    generated_firework_ids := array_append(generated_firework_ids, firework_id);
  end loop;

  if shot_count = 1 then
    shot_entry := reconstruction -> 'shots' -> 0;
    design_key := nullif(btrim(shot_entry ->> 'designKey'), '');
    firework_id := nullif(design_ids ->> design_key, '')::uuid;
    offset_seconds := nullif(shot_entry ->> 'timeOffsetSeconds', '')::numeric;
    pan_degrees := coalesce(nullif(shot_entry ->> 'panDegrees', '')::numeric, 0)::integer;
    tilt_degrees := coalesce(nullif(shot_entry ->> 'tiltDegrees', '')::numeric, 0)::integer;
    shot_scale := coalesce(nullif(shot_entry ->> 'scale', '')::numeric, 1);
    if firework_id is null
      or offset_seconds is null or offset_seconds not between 0 and product_duration_seconds
      or pan_degrees not between -30 and 30
      or tilt_degrees not between -50 and 50 then
      raise exception 'The reconstructed shot is outside the supported bounds.' using errcode = '22023';
    end if;

    position_override := coalesce(shot_entry -> 'position', '{}'::jsonb)
      || jsonb_build_object(
        'launchPositionIndex', coalesce(nullif(shot_entry ->> 'launchPositionIndex', '')::integer, 0),
        'seedOverride', coalesce(nullif(shot_entry ->> 'seed', '')::numeric, 101)::integer,
        'scale', shot_scale,
        'timeOffsetSeconds', offset_seconds,
        'sourceTimeOffsetSeconds', coalesce(
          nullif(shot_entry ->> 'sourceTimeOffsetSeconds', '')::numeric,
          offset_seconds
        ),
        'panDegrees', pan_degrees,
        'tiltDegrees', tilt_degrees,
        'observedBurstTimeSeconds', nullif(shot_entry ->> 'observedBurstTimeSeconds', '')::numeric,
        'observedFadeEndSeconds', nullif(shot_entry ->> 'observedFadeEndSeconds', '')::numeric
      );
    if jsonb_typeof(position_override) is distinct from 'object'
      or coalesce(nullif(position_override ->> 'x', '')::numeric, 0) not between -1000 and 1000
      or coalesce(nullif(position_override ->> 'y', '')::numeric, 0) not between -1000 and 1000
      or coalesce(nullif(position_override ->> 'z', '')::numeric, 0) not between -1000 and 1000
      or (position_override ->> 'launchPositionIndex')::integer not between 0 and 2
      or (position_override ->> 'seedOverride')::bigint not between 0 and 2147483647
      or (position_override ->> 'scale')::numeric not between 0.2 and 2 then
      raise exception 'The reconstructed shot position is invalid.' using errcode = '22023';
    end if;

    scaled_single_duration_seconds :=
      (render_evidence ->> 'requiredProductDurationSeconds')::numeric - offset_seconds;
    if scaled_single_duration_seconds <= 0 or scaled_single_duration_seconds > 60 then
      raise exception 'The scaled single-shot renderer duration is invalid.' using errcode = '22023';
    end if;

    select coalesce(nullif(btrim(firework.caliber), ''), '30mm') into calibre
    from public.fireworks firework
    where firework.id = firework_id;
    if calibre ~* '^\s*[0-9]+(?:\.[0-9]+)?\s*mm\s*$' then
      calibre := trim(trailing '.' from trim(trailing '0' from round(
        substring(calibre from '([0-9]+(?:\.[0-9]+)?)')::numeric * shot_scale,
        2
      )::text)) || 'mm';
    elsif calibre ~* '^\s*[0-9]+(?:\.[0-9]+)?\s*(?:in|inch|inches|\")\s*$' then
      calibre := trim(trailing '.' from trim(trailing '0' from round(
        substring(calibre from '([0-9]+(?:\.[0-9]+)?)')::numeric * 25.4 * shot_scale,
        2
      )::text)) || 'mm';
    else
      calibre := trim(trailing '.' from trim(trailing '0' from round(30 * shot_scale, 2)::text)) || 'mm';
    end if;

    update public.fireworks
    set caliber = calibre,
        duration_seconds = scaled_single_duration_seconds,
        variant_json = variant_json || jsonb_build_object('reconstructionShot', position_override)
    where id = firework_id;

    select item.id into generated_catalogue_item_id
    from public.catalogue_items item
    where item.firework_id = nullif(design_ids ->> design_key, '')::uuid
    for update;
    if generated_catalogue_item_id is null then
      raise exception 'The firework catalogue item was not created.' using errcode = 'P0001';
    end if;

    update public.catalogue_items
    set part_number = btrim(p_part_number),
        name = btrim(p_name),
        manufacturer = nullif(btrim(coalesce(p_manufacturer, '')), ''),
        description = nullif(btrim(reconstruction ->> 'description'), ''),
        firework_type = coalesce(
          nullif(btrim(coalesce(p_firework_type, '')), ''),
          'Video reconstructed'
        ),
        duration_seconds = (
          select firework.duration_seconds
          from public.fireworks firework
          where firework.id = nullif(design_ids ->> design_key, '')::uuid
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

    insert into public.multishots (
      slug,
      name,
      description,
      duration_seconds,
      shot_count,
      metadata
    ) values (
      'import-' || left(replace(p_job_id::text, '-', ''), 12),
      btrim(p_name),
      nullif(btrim(reconstruction ->> 'description'), ''),
      nullif(reconstruction ->> 'durationSeconds', '')::numeric,
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
      design_key := nullif(btrim(shot_entry ->> 'designKey'), '');
      firework_id := nullif(design_ids ->> design_key, '')::uuid;
      offset_seconds := nullif(shot_entry ->> 'timeOffsetSeconds', '')::numeric;
      pan_degrees := coalesce(nullif(shot_entry ->> 'panDegrees', '')::numeric, 0)::integer;
      tilt_degrees := coalesce(nullif(shot_entry ->> 'tiltDegrees', '')::numeric, 0)::integer;
      shot_scale := coalesce(nullif(shot_entry ->> 'scale', '')::numeric, 1);
      if firework_id is null
        or offset_seconds is null or offset_seconds not between 0 and product_duration_seconds
        or pan_degrees not between -30 and 30
        or tilt_degrees not between -50 and 50 then
        raise exception 'A reconstructed shot is outside the supported bounds.' using errcode = '22023';
      end if;

      position_override := coalesce(shot_entry -> 'position', '{}'::jsonb)
        || jsonb_build_object(
          'launchPositionIndex', coalesce(nullif(shot_entry ->> 'launchPositionIndex', '')::integer, 0),
          'seedOverride', coalesce(nullif(shot_entry ->> 'seed', '')::numeric, shot_index * 101)::integer,
          'scale', shot_scale,
          'sourceTimeOffsetSeconds', coalesce(
            nullif(shot_entry ->> 'sourceTimeOffsetSeconds', '')::numeric,
            offset_seconds
          ),
          'reconstructionShotId', coalesce(shot_entry ->> 'id', shot_index::text)
        );
      if jsonb_typeof(position_override) is distinct from 'object'
        or coalesce(nullif(position_override ->> 'x', '')::numeric, 0) not between -1000 and 1000
        or coalesce(nullif(position_override ->> 'y', '')::numeric, 0) not between -1000 and 1000
        or coalesce(nullif(position_override ->> 'z', '')::numeric, 0) not between -1000 and 1000
        or (position_override ->> 'launchPositionIndex')::integer not between 0 and 2
        or (position_override ->> 'seedOverride')::bigint not between 0 and 2147483647
        or (position_override ->> 'scale')::numeric not between 0.2 and 2 then
        raise exception 'A reconstructed shot position is invalid.' using errcode = '22023';
      end if;

      select coalesce(nullif(btrim(firework.caliber), ''), '30mm') into calibre
      from public.fireworks firework
      where firework.id = firework_id;
      if calibre ~* '^\s*[0-9]+(?:\.[0-9]+)?\s*mm\s*$' then
        calibre := trim(trailing '.' from trim(trailing '0' from round(
          substring(calibre from '([0-9]+(?:\.[0-9]+)?)')::numeric * shot_scale,
          2
        )::text)) || 'mm';
      elsif calibre ~* '^\s*[0-9]+(?:\.[0-9]+)?\s*(?:in|inch|inches|\")\s*$' then
        calibre := trim(trailing '.' from trim(trailing '0' from round(
          substring(calibre from '([0-9]+(?:\.[0-9]+)?)')::numeric * 25.4 * shot_scale,
          2
        )::text)) || 'mm';
      else
        calibre := trim(trailing '.' from trim(trailing '0' from round(30 * shot_scale, 2)::text)) || 'mm';
      end if;

      insert into public.multishot_fireworks (
        multishot_id,
        firework_id,
        sequence_index,
        time_offset_seconds,
        pan_degrees,
        tilt_degrees,
        position_override_json,
        caliber,
        notes
      ) values (
        generated_multishot_id,
        firework_id,
        shot_index,
        offset_seconds,
        pan_degrees,
        tilt_degrees,
        position_override,
        calibre,
        'Video reconstruction shot ' || shot_index
      );
    end loop;

    update public.multishots
    set shot_count = jsonb_array_length(reconstruction -> 'shots')
    where id = generated_multishot_id;

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
        description = nullif(btrim(reconstruction ->> 'description'), ''),
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

  update public.import_candidates
  set approved_at = now()
  where id = candidate_row.id;

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

revoke execute on function public.approve_firework_import_candidate(uuid, uuid, text, text, text, text, text)
  from public, anon;
grant execute on function public.approve_firework_import_candidate(uuid, uuid, text, text, text, text, text)
  to authenticated;
