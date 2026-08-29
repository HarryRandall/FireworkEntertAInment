begin;

-- FIR-178 owns assortments and assortment_items. Capability material lives in
-- a separate table because active assortment rows are intentionally readable
-- by anonymous catalogue clients.
create table public.assortment_public_links (
  assortment_id uuid primary key references public.assortments(id) on delete cascade,
  public_token text not null unique default (
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
  ),
  funding_user_id uuid not null references public.users(id) on delete restrict,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assortment_public_links_token_entropy_check
    check (public_token ~ '^[a-f0-9]{64}$')
);

comment on table public.assortment_public_links is
  'Protected reusable QR capabilities and interim retailer funding owners. This table is never readable by anon.';
comment on column public.assortment_public_links.public_token is
  'Stable high-entropy QR capability. Normal assortment edits never rotate it.';
comment on column public.assortment_public_links.funding_user_id is
  'Interim single-user retailer billing boundary for anonymous analysis and generation.';

create trigger assortment_public_links_set_updated_at
  before update on public.assortment_public_links
  for each row execute function public.set_updated_at();

-- New admin-created assortments receive their link in the same transaction.
-- Legacy or seeded rows can be linked explicitly through the guarded ensure
-- function below because they have no trustworthy funding owner to infer.
create or replace function private.create_assortment_public_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  funding_user_id uuid := coalesce(new.created_by, auth.uid());
begin
  if funding_user_id is not null then
    insert into public.assortment_public_links (assortment_id, funding_user_id)
    values (new.id, funding_user_id);
  end if;
  return new;
end;
$$;

revoke execute on function private.create_assortment_public_link()
  from public, anon, authenticated, service_role;

create trigger assortments_create_public_link
  after insert on public.assortments
  for each row execute function private.create_assortment_public_link();

-- Upload preparation is server-mediated. The browser receives only the raw
-- one-time capability while the database stores its SHA-256 hash.
create table public.assortment_song_selections (
  id uuid primary key default gen_random_uuid(),
  assortment_id uuid references public.assortments(id) on delete set null,
  funding_user_id uuid not null references public.users(id) on delete restrict,
  access_token_hash text not null unique,
  audio_path text not null unique,
  original_filename text,
  content_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 52428800),
  music_analysis_id uuid unique references public.song_analyses(id) on delete restrict,
  expires_at timestamptz not null default (now() + interval '2 hours'),
  created_at timestamptz not null default now(),
  constraint assortment_song_selections_token_hash_check
    check (access_token_hash ~ '^[a-f0-9]{64}$')
);

comment on table public.assortment_song_selections is
  'Short-lived anonymous upload capabilities funded by the owning retailer. Raw access tokens are never stored.';

create index assortment_song_selections_assortment_created_idx
  on public.assortment_song_selections (assortment_id, created_at desc);

alter table public.shows
  add column assortment_song_selection_id uuid
    references public.assortment_song_selections(id) on delete restrict,
  add column creation_source text not null default 'app'
    check (creation_source in ('app', 'assortment_qr')),
  add column public_access_token_hash text;

alter table public.shows
  add constraint shows_assortment_qr_provenance_check check (
    (creation_source = 'app'
      and assortment_song_selection_id is null
      and public_access_token_hash is null)
    or
    (creation_source = 'assortment_qr'
      and assortment_song_selection_id is not null
      and public_access_token_hash ~ '^[a-f0-9]{64}$')
  );

create unique index shows_public_access_token_hash_idx
  on public.shows (public_access_token_hash)
  where public_access_token_hash is not null;
-- This immutable ledger decouples an in-flight or completed show from later
-- edits to the reusable assortment definition.
create table public.show_assortment_items (
  show_id uuid not null references public.shows(id) on delete cascade,
  catalogue_item_id uuid not null references public.catalogue_items(id) on delete restrict,
  quantity integer not null check (quantity between 1 and 999),
  created_at timestamptz not null default now(),
  primary key (show_id, catalogue_item_id)
);

comment on table public.show_assortment_items is
  'Immutable SKU quantity snapshot captured atomically when an assortment QR show is created.';

alter table public.assortment_public_links enable row level security;
alter table public.assortment_song_selections enable row level security;
alter table public.show_assortment_items enable row level security;

revoke all on public.assortment_public_links from public, anon;
revoke all on public.assortment_song_selections from public, anon;
revoke all on public.show_assortment_items from public, anon;

create policy assortment_public_links_select_admin on public.assortment_public_links
  for select to authenticated
  using (public.current_user_has_permission('admin.manage_assortments'));

create policy assortment_song_selections_select_funder on public.assortment_song_selections
  for select to authenticated
  using (funding_user_id = (select auth.uid()));

create policy show_assortment_items_select_owner on public.show_assortment_items
  for select to authenticated
  using (exists (
    select 1 from public.shows show_row
    where show_row.id = show_id
      and show_row.user_id = (select auth.uid())
  ));

grant select on public.assortment_public_links to authenticated;
grant select on public.assortment_song_selections to authenticated;
grant select on public.show_assortment_items to authenticated;

create or replace function public.ensure_assortment_public_link(p_assortment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  link_row public.assortment_public_links;
begin
  if actor_id is null
    or not coalesce(public.current_user_is_active(), false)
    or not public.current_user_has_permission('admin.manage_assortments')
  then
    raise exception 'Not permitted.' using errcode = '42501';
  end if;
  perform 1 from public.assortments assortment
  where assortment.id = p_assortment_id
  for update;
  if not found then
    raise exception 'Assortment not found.' using errcode = 'P0002';
  end if;

  insert into public.assortment_public_links (assortment_id, funding_user_id)
  values (p_assortment_id, actor_id)
  on conflict (assortment_id) do nothing;

  select * into link_row
  from public.assortment_public_links link
  where link.assortment_id = p_assortment_id;

  return jsonb_build_object(
    'publicToken', link_row.public_token,
    'isEnabled', link_row.is_enabled,
    'fundingUserId', link_row.funding_user_id
  );
end;
$$;

revoke execute on function public.ensure_assortment_public_link(uuid)
  from public, anon, service_role;
grant execute on function public.ensure_assortment_public_link(uuid)
  to authenticated;

-- Internal reservation helper mirrors reserve_ai_credits, including usage
-- limits and idempotency, but is callable only from the service-role-only QR
-- preparation functions below.
create or replace function private.reserve_assortment_ai_credit(
  p_user_id uuid,
  p_action_key text,
  p_reference_type text,
  p_reference_id uuid,
  p_idempotency_key text,
  p_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_row public.ai_credit_accounts%rowtype;
  existing_row public.ai_credit_transactions%rowtype;
  usage_row jsonb;
  available_credits integer;
  credit_cost integer;
begin
  select cost.amount into credit_cost
  from public.ai_credit_costs cost
  where cost.key = p_action_key;
  if not found or credit_cost <= 0 then
    raise exception 'Unknown or invalid AI credit action.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));
  select * into existing_row
  from public.ai_credit_transactions transaction_row
  where transaction_row.idempotency_key = p_idempotency_key;
  if found then
    if existing_row.user_id <> p_user_id
      or existing_row.action_key <> p_action_key
      or existing_row.reference_type <> p_reference_type
      or existing_row.reference_id <> p_reference_id
      or existing_row.transaction_type <> 'reserve'
    then
      raise exception 'AI credit idempotency key is already in use.' using errcode = '23505';
    end if;
    return;
  end if;

  perform public.ensure_ai_credit_account(p_user_id);
  select * into account_row
  from public.ai_credit_accounts account
  where account.user_id = p_user_id
  for update;
  if not found then
    raise exception 'Retailer AI credit account was not found.' using errcode = 'P0002';
  end if;

  usage_row := public.ai_credit_usage_payload(p_user_id);
  available_credits := coalesce((usage_row ->> 'available')::integer, 0);
  if credit_cost > available_credits then
    raise exception 'The retailer does not have enough AI credits.' using errcode = 'P0001';
  end if;

  update public.ai_credit_accounts
  set reserved = reserved + credit_cost
  where user_id = p_user_id
  returning * into account_row;

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
    metadata,
    created_by
  ) values (
    p_user_id,
    'reserve',
    'reserved',
    p_action_key,
    credit_cost,
    account_row.balance,
    account_row.reserved,
    p_reference_type,
    p_reference_id,
    p_idempotency_key,
    coalesce(p_metadata, '{}'::jsonb),
    null
  );
end;
$$;

revoke execute on function private.reserve_assortment_ai_credit(
  uuid, text, text, uuid, text, jsonb
) from public, anon, authenticated, service_role;

create or replace function public.prepare_assortment_song_analysis(
  p_assortment_token text,
  p_selection_id uuid,
  p_analysis_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  link_row public.assortment_public_links;
  assortment_row public.assortments;
  selection_row public.assortment_song_selections;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Not permitted.' using errcode = '42501';
  end if;

  select * into link_row
  from public.assortment_public_links link
  where link.public_token = p_assortment_token
    and link.is_enabled = true
  for share;
  if not found then
    raise exception 'Assortment unavailable.' using errcode = 'P0002';
  end if;

  select * into assortment_row
  from public.assortments assortment
  where assortment.id = link_row.assortment_id
    and assortment.is_active = true
  for share;
  if not found then
    raise exception 'Assortment unavailable.' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.users funding_user
    where funding_user.id = link_row.funding_user_id
      and funding_user.status = 'active'
  ) then
    raise exception 'Assortment unavailable.' using errcode = 'P0002';
  end if;

  select * into selection_row
  from public.assortment_song_selections selection
  where selection.id = p_selection_id
    and selection.assortment_id = assortment_row.id
    and selection.funding_user_id = link_row.funding_user_id
  for update;
  if not found
    or selection_row.expires_at <= now()
    or selection_row.music_analysis_id is not null
  then
    raise exception 'Song selection unavailable.' using errcode = 'P0002';
  end if;

  perform private.reserve_assortment_ai_credit(
    link_row.funding_user_id,
    'music_analysis',
    'song_analyses',
    p_analysis_id,
    'music-analysis:' || p_analysis_id::text || ':reserve',
    jsonb_build_object(
      'assortmentId', assortment_row.id,
      'source', 'assortment_qr',
      'audioPath', selection_row.audio_path,
      'contentType', selection_row.content_type,
      'sizeBytes', selection_row.size_bytes
    )
  );

  insert into public.song_analyses (
    id,
    user_id,
    audio_path,
    original_filename,
    content_type,
    size_bytes,
    personality,
    status,
    runner_version,
    schema_version
  ) values (
    p_analysis_id,
    link_row.funding_user_id,
    selection_row.audio_path,
    selection_row.original_filename,
    selection_row.content_type,
    selection_row.size_bytes,
    'balanced',
    'running',
    'modal-librosa-2',
    '1.4.0'
  );

  update public.assortment_song_selections
  set music_analysis_id = p_analysis_id
  where id = selection_row.id;

  return jsonb_build_object(
    'ok', true,
    'analysisId', p_analysis_id,
    'fundingUserId', link_row.funding_user_id
  );
end;
$$;

revoke execute on function public.prepare_assortment_song_analysis(text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.prepare_assortment_song_analysis(text, uuid, uuid)
  to service_role;

create or replace function public.create_assortment_qr_show(
  p_assortment_token text,
  p_selection_id uuid,
  p_public_access_token_hash text,
  p_title text,
  p_generation_mode text,
  p_selected_cue_model text,
  p_credit_action_key text,
  p_cover_shader jsonb,
  p_source_show_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  link_row public.assortment_public_links;
  assortment_row public.assortments;
  selection_row public.assortment_song_selections;
  source_show_row public.shows;
  show_id uuid := gen_random_uuid();
  show_slug text := 'assortment-show-' || left(replace(gen_random_uuid()::text, '-', ''), 12);
  item_count integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Not permitted.' using errcode = '42501';
  end if;
  if p_generation_mode not in ('fast', 'llm')
    or p_public_access_token_hash !~ '^[a-f0-9]{64}$'
    or nullif(btrim(p_title), '') is null
    or char_length(btrim(p_title)) > 120
  then
    raise exception 'Invalid QR show request.' using errcode = '22023';
  end if;

  select * into link_row
  from public.assortment_public_links link
  where link.public_token = p_assortment_token
    and link.is_enabled = true
  for share;
  if not found then
    raise exception 'Assortment unavailable.' using errcode = 'P0002';
  end if;

  select * into assortment_row
  from public.assortments assortment
  where assortment.id = link_row.assortment_id
    and assortment.is_active = true
  for share;
  if not found then
    raise exception 'Assortment unavailable.' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.users funding_user
    where funding_user.id = link_row.funding_user_id
      and funding_user.status = 'active'
  ) then
    raise exception 'Assortment unavailable.' using errcode = 'P0002';
  end if;

  select * into selection_row
  from public.assortment_song_selections selection
  where selection.id = p_selection_id
    and selection.assortment_id = assortment_row.id
    and selection.funding_user_id = link_row.funding_user_id
    and selection.music_analysis_id is not null
  for share;
  if not found or not exists (
    select 1 from public.song_analyses analysis
    where analysis.id = selection_row.music_analysis_id
      and analysis.user_id = link_row.funding_user_id
      and analysis.status in ('running', 'completed')
  ) then
    raise exception 'Song selection unavailable.' using errcode = 'P0002';
  end if;

  if p_source_show_id is not null then
    select * into source_show_row
    from public.shows source_show
    where source_show.id = p_source_show_id
      and source_show.user_id = link_row.funding_user_id
      and source_show.creation_source = 'assortment_qr'
      and source_show.assortment_id = assortment_row.id
      and source_show.assortment_song_selection_id = selection_row.id
    for share;
    if not found then
      raise exception 'Source show unavailable.' using errcode = 'P0002';
    end if;

    select count(*)::integer into item_count
    from public.show_assortment_items snapshot
    where snapshot.show_id = source_show_row.id;
  else
    select count(*)::integer into item_count
    from public.assortment_items item
    where item.assortment_id = assortment_row.id;
  end if;
  if item_count = 0 then
    raise exception 'Assortment unavailable.' using errcode = 'P0002';
  end if;

  insert into public.shows (
    id,
    user_id,
    slug,
    title,
    song,
    status,
    duration_seconds,
    budget_cents,
    time_of_day,
    description,
    audio_path,
    music_analysis_id,
    cover_shader,
    show_style,
    selected_cue_model,
    generation_status,
    generation_started_at,
    assortment_id,
    assortment_song_selection_id,
    creation_source,
    public_access_token_hash
  ) values (
    show_id,
    link_row.funding_user_id,
    show_slug,
    btrim(p_title),
    selection_row.original_filename,
    'draft',
    null,
    case
      when p_source_show_id is not null then source_show_row.budget_cents
      else assortment_row.price_cents
    end,
    'night',
    'Generated from the fixed ' || assortment_row.name || ' assortment QR.',
    selection_row.audio_path,
    selection_row.music_analysis_id,
    p_cover_shader,
    'signature',
    case when p_generation_mode = 'llm' then p_selected_cue_model else null end,
    'running',
    now(),
    assortment_row.id,
    selection_row.id,
    'assortment_qr',
    p_public_access_token_hash
  );

  if p_source_show_id is not null then
    insert into public.show_assortment_items (show_id, catalogue_item_id, quantity)
    select show_id, snapshot.catalogue_item_id, snapshot.quantity
    from public.show_assortment_items snapshot
    where snapshot.show_id = source_show_row.id;
  else
    insert into public.show_assortment_items (show_id, catalogue_item_id, quantity)
    select show_id, item.catalogue_item_id, item.quantity
    from public.assortment_items item
    where item.assortment_id = assortment_row.id;
  end if;

  perform private.reserve_assortment_ai_credit(
    link_row.funding_user_id,
    p_credit_action_key,
    'shows',
    show_id,
    'show-generation:' || show_id::text || ':reserve',
    jsonb_build_object(
      'assortmentId', assortment_row.id,
      'generationMode', p_generation_mode,
      'model', case when p_generation_mode = 'llm' then p_selected_cue_model else null end,
      'sourceShowId', p_source_show_id,
      'source', 'assortment_qr'
    )
  );

  return jsonb_build_object(
    'ok', true,
    'showId', show_id,
    'showSlug', show_slug,
    'fundingUserId', link_row.funding_user_id,
    'musicAnalysisId', selection_row.music_analysis_id
  );
end;
$$;

revoke execute on function public.create_assortment_qr_show(
  text, uuid, text, text, text, text, text, jsonb, uuid
) from public, anon, authenticated;
grant execute on function public.create_assortment_qr_show(
  text, uuid, text, text, text, text, text, jsonb, uuid
) to service_role;

-- Preserve the authenticated contract while permitting the trusted backend to
-- persist QR generation. The snapshot ledger is enforced in the same guarded
-- transaction for every assortment-linked write.
create or replace function public.replace_show_timeline_items(
  p_show_id uuid,
  p_user_id uuid,
  p_items jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text := auth.role();
  target_show public.shows;
  replaced_count integer := 0;
begin
  if actor_role is distinct from 'service_role' and (
    actor_id is null
    or p_user_id is distinct from actor_id
    or not coalesce(public.current_user_is_active(), false)
  ) then
    raise exception 'Not permitted.' using errcode = '42501';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array'
    or jsonb_array_length(p_items) = 0
  then
    raise exception 'Timeline replacement payload must contain at least one cue.'
      using errcode = '22023';
  end if;

  select * into target_show
  from public.shows show_row
  where show_row.id = p_show_id
    and show_row.user_id = p_user_id
  for update;
  if not found then
    raise exception 'Show was not found.' using errcode = 'P0002';
  end if;

  if actor_role = 'service_role' then
    if target_show.creation_source <> 'assortment_qr' then
      raise exception 'Service-role timeline replacement is limited to QR shows.'
        using errcode = '42501';
    end if;
  end if;

  if target_show.creation_source = 'assortment_qr' and (
    not exists (
      select 1 from public.show_assortment_items snapshot
      where snapshot.show_id = target_show.id
    )
    or exists (
      select 1
      from jsonb_to_recordset(p_items) as cue(catalogue_item_id uuid)
      left join public.show_assortment_items snapshot
        on snapshot.show_id = target_show.id
        and snapshot.catalogue_item_id = cue.catalogue_item_id
      where cue.catalogue_item_id is null
        or snapshot.catalogue_item_id is null
    )
    or exists (
      select 1
      from public.show_assortment_items snapshot
      where snapshot.show_id = target_show.id
        and (
          select count(*)
          from jsonb_to_recordset(p_items) as cue(catalogue_item_id uuid)
          where cue.catalogue_item_id = snapshot.catalogue_item_id
        ) <> snapshot.quantity
    )
  ) then
    raise exception 'Generated cues must consume every assortment product exactly once per purchased unit.'
      using errcode = '23514';
  end if;

  delete from public.show_timeline_items timeline_item
  where timeline_item.show_id = p_show_id;

  insert into public.show_timeline_items (
    show_id,
    position,
    time_seconds,
    description,
    catalogue_item_id,
    launch_position_index,
    emphasis
  )
  select
    p_show_id,
    cue.position,
    cue.time_seconds,
    cue.description,
    cue.catalogue_item_id,
    cue.launch_position_index,
    cue.emphasis
  from jsonb_to_recordset(p_items) as cue(
    position integer,
    time_seconds numeric,
    description text,
    catalogue_item_id uuid,
    launch_position_index integer,
    emphasis text
  )
  order by cue.position;

  get diagnostics replaced_count = row_count;
  return replaced_count;
end;
$$;

revoke execute on function public.replace_show_timeline_items(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.replace_show_timeline_items(uuid, uuid, jsonb)
  to authenticated, service_role;

commit;
