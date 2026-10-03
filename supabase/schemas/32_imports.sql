-- Supplier submissions, measured video evidence, proposed designs and client-append-only QA decisions.
create table public.imports (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id),
  media_id uuid not null references public.media(id),
  submitted_by uuid references public.profiles(id),
  stage text not null default 'uploaded' check (stage in ('uploaded','reading','matching','review','published','failed')),
  mapping jsonb not null default '{}' check (jsonb_typeof(mapping) = 'object'),
  counts jsonb not null default '{}' check (jsonb_typeof(counts) = 'object'),
  error text, published_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (supplier_id, id)
);
create index imports_supplier_idx on public.imports(supplier_id);
create index imports_media_idx on public.imports(media_id);
create table public.import_lines (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.imports(id) on delete cascade,
  row_number int not null check (row_number > 0),
  raw jsonb not null check (jsonb_typeof(raw) = 'object'),
  supplier_product_id uuid references public.supplier_products(id),
  suggested_product_id uuid references public.products(id),
  confidence numeric(3,2) check (confidence between 0 and 1),
  state text not null check (state in ('auto','suggested','new','accepted','rejected','error')),
  decided_by uuid references public.profiles(id), decided_at timestamptz, note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (import_id, row_number),
  check ((decided_by is null) = (decided_at is null))
);
create table public.video_analyses (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.media(id),
  product_id uuid references public.products(id),
  supplier_product_id uuid references public.supplier_products(id),
  extractor text not null check (length(extractor) > 0),
  priors jsonb not null default '{}' check (jsonb_typeof(priors) = 'object'),
  shots jsonb check (jsonb_typeof(shots) = 'array'),
  features jsonb, keyframes jsonb,
  status text not null default 'queued' check (status in ('queued','measuring','interpreting','fitting','ready','failed')),
  error text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index video_analyses_media_idx on public.video_analyses(media_id);
create index video_analyses_product_idx on public.video_analyses(product_id);
create index video_analyses_supplier_product_idx on public.video_analyses(supplier_product_id);
create table public.design_candidates (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.video_analyses(id) on delete cascade,
  source text not null check (source in ('llm','fit','manual')),
  model text, parent_id uuid,
  proposal jsonb not null check (jsonb_typeof(proposal) = 'object'),
  scores jsonb not null default '{}' check (jsonb_typeof(scores) = 'object'),
  overall numeric(4,3) check (overall between 0 and 1),
  renderer text not null check (length(renderer) > 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (analysis_id, id),
  foreign key (analysis_id, parent_id) references public.design_candidates(analysis_id, id),
  check (parent_id <> id)
);
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  effect_version_id uuid references public.effect_versions(id) on delete cascade,
  product_version_id uuid references public.product_versions(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id),
  decision text not null check (decision in ('approved','changes_requested','rejected','comment')),
  reasons text[] not null default '{}', note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((effect_version_id is null) <> (product_version_id is null))
);
create index reviews_effect_version_idx on public.reviews(effect_version_id);
create index reviews_product_version_idx on public.reviews(product_version_id);
alter table public.product_versions add constraint product_versions_candidate_fk
  foreign key (candidate_id) references public.design_candidates(id);
create unique index product_versions_candidate_idx on public.product_versions(candidate_id) where candidate_id is not null;
alter table public.supplier_products add constraint supplier_products_last_import_fk
  foreign key (last_import_id) references public.imports(id);
alter table public.supplier_products add constraint supplier_products_import_supplier_fk
  foreign key (supplier_id, last_import_id) references public.imports(supplier_id, id);
comment on column public.product_versions.candidate_id is 'Accepted public.design_candidates(id), retained as video reconstruction provenance.';
comment on column public.supplier_products.last_import_id is 'Latest public.imports(id) supplying this listing, from the same supplier.';

-- Validate linked evidence as the owner so supplier RLS cannot conceal a foreign reference.
create or replace function private.guard_import_evidence()
returns trigger language plpgsql security definer set search_path = '' as $$
#variable_conflict error
begin
  if tg_op = 'UPDATE' and (new.supplier_id is distinct from old.supplier_id or new.media_id is distinct from old.media_id
    or new.submitted_by is distinct from old.submitted_by) then
    raise exception using errcode = '23514', message = 'Import submission identity is immutable';
  end if;
  if not exists (select from public.media as media where media.id = new.media_id
    and media.supplier_id = new.supplier_id and media.organisation_id is null
    and media.kind = 'price_list') then
    raise exception using errcode = '23514', message = 'Import requires a price list owned by its supplier';
  end if;
  return new;
end;
$$;
comment on function private.guard_import_evidence() is 'Requires price-list evidence owned by the submitting supplier, including trusted backend writes.';
create trigger guard_evidence before insert or update on public.imports for each row execute function private.guard_import_evidence();

-- Keep matched listings inside the supplier boundary of the original upload.
create or replace function private.guard_import_line()
returns trigger language plpgsql security definer set search_path = '' as $$
#variable_conflict error
begin
  if new.supplier_product_id is not null and not exists (
    select from public.imports as upload join public.supplier_products as listing on listing.supplier_id = upload.supplier_id
    where upload.id = new.import_id and listing.id = new.supplier_product_id
  ) then
    raise exception using errcode = '23514', message = 'Matched listing must belong to the import supplier';
  end if;
  return new;
end;
$$;
comment on function private.guard_import_line() is 'Rejects import lines matched to another supplier listing.';
create trigger guard_listing before insert or update on public.import_lines for each row execute function private.guard_import_line();

-- Require video evidence and compatible supplier/product priors, without inferring safety.
create or replace function private.guard_video_evidence()
returns trigger language plpgsql security definer set search_path = '' as $$
#variable_conflict error
begin
  if tg_op = 'UPDATE' and exists (
    select from public.design_candidates as candidate join public.product_versions as version on version.candidate_id = candidate.id
    where candidate.analysis_id = old.id
  ) and (to_jsonb(new) - 'updated_at') is distinct from (to_jsonb(old) - 'updated_at') then
    raise exception using errcode = '23514', message = 'Accepted video evidence is immutable';
  end if;
  if not exists (select from public.media as media where media.id = new.media_id and media.kind = 'video') then
    raise exception using errcode = '23514', message = 'Analysis requires video media';
  end if;
  if new.supplier_product_id is not null and not exists (
    select from public.supplier_products as listing join public.media as media on media.supplier_id = listing.supplier_id
    where listing.id = new.supplier_product_id and media.id = new.media_id
      and (new.product_id is null or listing.product_id is null or listing.product_id = new.product_id)
  ) then
    raise exception using errcode = '23514', message = 'Video listing must match its media supplier and product';
  end if;
  return new;
end;
$$;
comment on function private.guard_video_evidence() is 'Rejects non-video evidence and incompatible supplier/product links.';
create trigger guard_evidence before insert or update on public.video_analyses for each row execute function private.guard_video_evidence();

alter table public.imports enable row level security;
create trigger set_updated_at before update on public.imports for each row execute function private.set_updated_at();

alter table public.import_lines enable row level security;
create trigger set_updated_at before update on public.import_lines for each row execute function private.set_updated_at();

alter table public.video_analyses enable row level security;
create trigger set_updated_at before update on public.video_analyses for each row execute function private.set_updated_at();

alter table public.design_candidates enable row level security;
create trigger set_updated_at before update on public.design_candidates for each row execute function private.set_updated_at();

alter table public.reviews enable row level security;
create trigger set_updated_at before update on public.reviews for each row execute function private.set_updated_at();
create policy imports_select on public.imports for select to authenticated
  using ((select private.staff_role()) is not null or supplier_id in (select private.supplier_ids()));
create policy imports_insert on public.imports for insert to authenticated with check (submitted_by = (select private.uid()) and ((select private.staff_role()) in ('super_admin','catalogue_editor') or (supplier_id in (select private.supplier_ids()) and stage = 'uploaded' and mapping = '{}'::jsonb and counts = '{}'::jsonb and error is null and published_at is null)));
create policy imports_update on public.imports for update to authenticated
  using ((select private.staff_role()) in ('super_admin','catalogue_editor'))
  with check ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy imports_delete on public.imports for delete to authenticated
  using ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy import_lines_select on public.import_lines for select to authenticated
  using ((select private.staff_role()) is not null or exists (select from public.imports as upload where upload.id = import_id and upload.supplier_id in (select private.supplier_ids())));
create policy import_lines_insert on public.import_lines for insert to authenticated with check ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy import_lines_update on public.import_lines for update to authenticated
  using ((select private.staff_role()) in ('super_admin','catalogue_editor'))
  with check ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy import_lines_delete on public.import_lines for delete to authenticated
  using ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy video_analyses_select on public.video_analyses for select to authenticated
  using ((select private.staff_role()) is not null);
create policy video_analyses_insert on public.video_analyses for insert to authenticated with check ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy video_analyses_update on public.video_analyses for update to authenticated
  using ((select private.staff_role()) in ('super_admin','catalogue_editor'))
  with check ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy video_analyses_delete on public.video_analyses for delete to authenticated
  using ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy design_candidates_select on public.design_candidates for select to authenticated
  using ((select private.staff_role()) is not null);
create policy design_candidates_insert on public.design_candidates for insert to authenticated with check ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy design_candidates_update on public.design_candidates for update to authenticated
  using ((select private.staff_role()) in ('super_admin','catalogue_editor'))
  with check ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy design_candidates_delete on public.design_candidates for delete to authenticated
  using ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy reviews_select on public.reviews for select to authenticated
  using ((select private.staff_role()) is not null);
create policy reviews_insert on public.reviews for insert to authenticated
  with check (reviewer_id = (select private.uid()) and (select private.staff_role()) in ('super_admin','catalogue_editor','reviewer'));

-- Object overrides preserve unspecified fields; arrays and scalar values replace whole values.
create or replace function private.merge_design_overrides(p_base jsonb, p_overrides jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
#variable_conflict error
declare
  v_result jsonb := p_base;
  v_entry record;
begin
  for v_entry in select entry.key, entry.value from jsonb_each(p_overrides) as entry loop
    if jsonb_typeof(v_entry.value) = 'object' and jsonb_typeof(v_result->v_entry.key) = 'object' then
      v_result := jsonb_set(v_result, array[v_entry.key], private.merge_design_overrides(v_result->v_entry.key, v_entry.value));
    else
      v_result := jsonb_set(v_result, array[v_entry.key], v_entry.value);
    end if;
  end loop;
  return v_result;
end;
$$;
comment on function private.merge_design_overrides(jsonb, jsonb) is 'Returns a recursively overridden design object; arrays, scalars and explicit JSON null replace values, with no unit conversion.';

-- Validate the candidate document and exact letter coverage before creating catalogue rows.
create or replace function private.check_candidate_proposal(p_proposal jsonb, p_kind text)
returns void language plpgsql set search_path = '' as $$
#variable_conflict error
declare
  v_composition jsonb := p_proposal->'composition';
  v_effects jsonb := p_proposal->'effects';
begin
  if jsonb_typeof(v_effects) is distinct from 'object' or v_effects = '{}'::jsonb
    or not coalesce(extensions.jsonb_matches_schema(private.composition_schema(), v_composition), false)
    or exists (select from jsonb_object_keys(p_proposal) as entry(key) where entry.key not in ('effects','composition')) then
    raise exception using errcode = '23514', message = 'Candidate requires effects and a valid composition';
  end if;
  if jsonb_array_length(v_composition->'tubes') = 0 or p_kind = 'pack'
    or (p_kind in ('single','fountain','wheel','ground') and jsonb_array_length(v_composition->'tubes') <> 1) then
    raise exception using errcode = '23514', message = 'Tube count does not match product kind';
  end if;
  if exists (select from jsonb_array_elements(v_composition->'tubes') as tube
    group by tube->>'i' having count(*) > 1)
    or exists (select from jsonb_array_elements(v_composition->'tubes') as tube where tube ? 'pos'
      group by tube->'pos' having count(*) > 1) then
    raise exception using errcode = '23514', message = 'Tube indices and positions must be unique';
  end if;
  if exists (select from jsonb_array_elements(v_composition->'tubes') as tube where
    (p_kind in ('rocket_pack','candle') and tube->'t_ms' <> 'null'::jsonb)
    or (p_kind not in ('rocket_pack','candle') and tube->'t_ms' = 'null'::jsonb)
    or (v_composition ? 'box' and (tube->>'i')::int >= (v_composition#>>'{box,rows}')::int * (v_composition#>>'{box,cols}')::int)
    or (v_composition ? 'box' and tube ? 'pos' and (
      (tube#>>'{pos,0}')::int >= (v_composition#>>'{box,rows}')::int
      or (tube#>>'{pos,1}')::int >= (v_composition#>>'{box,cols}')::int))) then
    raise exception using errcode = '23514', message = 'Invalid tube timing or grid position';
  end if;
  if exists (select from jsonb_array_elements(v_composition->'tubes') as tube where not (v_effects ? (tube->>'letter')))
    or exists (select from jsonb_each(v_effects) as entry where entry.key !~ '^[a-z]{1,2}$'
      or not exists (select from jsonb_array_elements(v_composition->'tubes') as tube where tube->>'letter' = entry.key)) then
    raise exception using errcode = '23514', message = 'Candidate effects must match tube letters exactly';
  end if;
end;
$$;
comment on function private.check_candidate_proposal(jsonb, text) is 'Validates composition shape, product-kind timing in ms from first firing, grid bounds and exact effect-letter coverage; does not require publication.';

-- Resolve a published template by slug, then let the canonical design constraint validate overrides.
create or replace function private.create_candidate_effect(p_candidate_id uuid, p_letter text, p_effect jsonb, p_renderer text, p_media_id uuid)
returns uuid language plpgsql set search_path = '' as $$
#variable_conflict error
declare
  v_template record;
  v_design jsonb;
  v_version_id uuid;
  v_effect_id uuid;
begin
  if jsonb_typeof(p_effect) is distinct from 'object' then
    raise exception using errcode = '23514', message = 'Effect proposal must be an object';
  end if;
  if jsonb_typeof(p_effect->'template') is distinct from 'string'
    or (p_effect ? 'overrides' and jsonb_typeof(p_effect->'overrides') is distinct from 'object')
    or exists (select from jsonb_object_keys(p_effect) as entry(key) where entry.key not in ('template','overrides')) then
    raise exception using errcode = '23514', message = 'Effect proposal requires a template slug and object overrides';
  end if;
  select effect.name, effect.family, effect.kind, version.design into v_template
    from public.effects as effect join public.effect_versions as version on version.id = effect.current_version_id
    where effect.slug = p_effect->>'template' and effect.is_template and effect.status = 'published' and version.status = 'published'
    for share of effect, version;
  if not found then raise exception using errcode = '23514', message = 'Published effect template required'; end if;
  v_design := private.merge_design_overrides(v_template.design, coalesce(p_effect->'overrides', '{}'::jsonb));
  if v_design->>'kind' is distinct from v_template.kind then
    raise exception using errcode = '23514', message = 'Overrides cannot change template kind';
  end if;
  v_version_id := private.create_effect_draft(null, 'video-' || p_candidate_id::text || '-' || p_letter,
    v_template.name || ' (' || p_letter || ')', v_template.family, v_design, p_renderer);
  update public.effect_versions as version set reference_media_id = p_media_id where version.id = v_version_id returning version.effect_id into v_effect_id;
  return v_effect_id;
end;
$$;
comment on function private.create_candidate_effect(uuid, text, jsonb, text, uuid) is 'Creates one validated draft effect from a published template slug and recursive overrides, recording renderer and video reference; returns the effect UUID.';

-- Serialise acceptance and return the existing result on retry, preserving its provenance.
create or replace function private.accept_design_candidate(p_candidate_id uuid, p_slug text default null, p_name text default null, p_kind text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  v_candidate public.design_candidates%rowtype;
  v_analysis public.video_analyses%rowtype;
  v_product_slug text;
  v_product_name text;
  v_product_kind text;
  v_product_status text;
  v_draft_version_id uuid;
  v_version_id uuid;
  v_bindings jsonb := '{}'::jsonb;
  v_entry record;
  v_effect_id uuid;
begin
  perform private.require_catalogue_editor();
  select candidate.* into v_candidate from public.design_candidates as candidate where candidate.id = p_candidate_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Candidate not found'; end if;
  select version.id into v_version_id from public.product_versions as version where version.candidate_id = p_candidate_id;
  if found then return v_version_id; end if;
  select analysis.* into v_analysis from public.video_analyses as analysis where analysis.id = v_candidate.analysis_id for update;
  if v_analysis.status <> 'ready' then raise exception using errcode = '23514', message = 'Ready video analysis required'; end if;
  if v_analysis.product_id is not null then
    select product.slug, product.name, product.kind, product.status, product.draft_version_id
      into v_product_slug, v_product_name, v_product_kind, v_product_status, v_draft_version_id
      from public.products as product where product.id = v_analysis.product_id for update;
    if v_product_status = 'archived' or v_draft_version_id is not null then
      raise exception using errcode = '23514', message = 'Product must be active with no open draft';
    end if;
  else
    if nullif(btrim(p_slug), '') is null or nullif(btrim(p_name), '') is null or p_kind is null then
      raise exception using errcode = '23514', message = 'New product slug, name and kind required';
    end if;
    v_product_slug := p_slug;
    v_product_name := p_name;
    v_product_kind := p_kind;
  end if;
  perform private.check_candidate_proposal(v_candidate.proposal, v_product_kind);
  for v_entry in select entry.key, entry.value from jsonb_each(v_candidate.proposal->'effects') as entry order by entry.key loop
    v_effect_id := private.create_candidate_effect(p_candidate_id, v_entry.key, v_entry.value, v_candidate.renderer, v_analysis.media_id);
    v_bindings := v_bindings || jsonb_build_object(v_entry.key, v_effect_id);
  end loop;
  v_version_id := private.create_product_draft(v_analysis.product_id, v_product_slug, v_product_name, v_product_kind,
    v_candidate.proposal->'composition', v_bindings, 'video_import');
  update public.product_versions as version set candidate_id = p_candidate_id where version.id = v_version_id;
  return v_version_id;
end;
$$;
comment on function private.accept_design_candidate(uuid, text, text, text) is 'Atomically accepts a ready video candidate into draft effects and one video_import product version. Existing products keep metadata and published pointers; new products require slug/name/kind. Retries return the same version UUID.';

-- Expose acceptance through an invoker wrapper with narrowly granted owner-backed writes.
create or replace function public.accept_design_candidate(p_candidate_id uuid, p_slug text default null, p_name text default null, p_kind text default null)
returns uuid language sql set search_path = '' as $$
  select private.accept_design_candidate(p_candidate_id, p_slug, p_name, p_kind);
$$;
comment on function public.accept_design_candidate(uuid, text, text, text) is 'Creates draft catalogue content from a ready video candidate, with schema-validated template overrides and no publication or safety confirmation; returns the idempotent product-version UUID.';

-- Accepted proposals are provenance, so even backend callers cannot rewrite them.
create or replace function private.guard_accepted_candidate()
returns trigger language plpgsql security definer set search_path = '' as $$
#variable_conflict error
begin
  if exists (select from public.product_versions as version where version.candidate_id = old.id) then
    raise exception using errcode = '23514', message = 'Accepted candidate is immutable';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
comment on function private.guard_accepted_candidate() is 'Preserves accepted candidate provenance against update and delete, including service-role writes.';
create trigger guard_accepted before update or delete on public.design_candidates for each row execute function private.guard_accepted_candidate();

-- Freezes the exact reviewed draft and records the author's request in one transaction.
create or replace function private.submit_effect_version(p_version_id uuid, p_design jsonb, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  version public.effect_versions;
begin
  perform private.require_catalogue_editor();
  select * into version from public.effect_versions where id = p_version_id;
  if not found then raise exception using errcode = 'P0002', message = 'Effect version not found'; end if;
  perform 1 from public.effects where id = version.effect_id and status <> 'archived' for update;
  if not found then raise exception using errcode = '23514', message = 'Active firework required'; end if;
  select * into version from public.effect_versions where id = p_version_id for update;
  if version.status <> 'draft' or version.design is distinct from p_design or not exists (
    select from public.effects where id = version.effect_id and draft_version_id = version.id) then
    raise exception using errcode = '23514', message = 'The reviewed draft has changed. Reload before submitting';
  end if;
  update public.effect_versions set status = 'in_review', submitted_at = now(), change_note = p_note where id = version.id;
  insert into public.reviews(effect_version_id,reviewer_id,decision,note)
    values (version.id,private.uid(),'comment',p_note);
end;
$$;
comment on function private.submit_effect_version(uuid,jsonb,text) is 'Freezes an exact current draft snapshot and records a review request attributed to the active catalogue editor.';

-- Caller wrapper for atomic review submission.
create or replace function public.submit_effect_version(p_version_id uuid, p_design jsonb, p_note text)
returns void language sql set search_path = '' as $$
  select private.submit_effect_version(p_version_id,p_design,p_note);
$$;
comment on function public.submit_effect_version(uuid,jsonb,text) is 'Submits an exact current draft and records its review request.';

-- Keeps the current snapshot before creating a restored draft, never rewriting saved history.
create or replace function private.restore_effect_version(p_effect_id uuid, p_version_id uuid, p_current_version_id uuid, p_design jsonb, p_renderer text)
returns uuid language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  effect public.effects;
  target public.effect_versions;
  current_version public.effect_versions;
  restored_id uuid;
begin
  perform private.require_catalogue_editor();
  select * into effect from public.effects where id = p_effect_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Firework not found'; end if;
  if effect.status = 'archived' then raise exception using errcode = '23514', message = 'Active firework required'; end if;
  select * into target from public.effect_versions where id = p_version_id and effect_id = effect.id;
  if not found then raise exception using errcode = 'P0002', message = 'Matching history version required'; end if;
  select * into current_version from public.effect_versions where id = coalesce(effect.draft_version_id,effect.current_version_id) for update;
  if current_version.id is distinct from p_current_version_id or current_version.design is distinct from p_design or
     current_version.status not in ('draft','published') then
    raise exception using errcode = '23514', message = 'The current draft has changed. Reload before restoring';
  end if;
  if current_version.status = 'draft' then
    update public.effect_versions set status = 'superseded', change_note = concat_ws(E'\n',change_note,'Kept before restoring an older version') where id = current_version.id;
  end if;
  update public.effects set draft_version_id = null where id = effect.id;
  restored_id := private.create_effect_draft(effect.id,effect.slug,effect.name,effect.family,target.design,p_renderer,target.id);
  update public.effect_versions set change_note = 'Restored version ' || target.number where id = restored_id;
  return restored_id;
end;
$$;
comment on function private.restore_effect_version(uuid,uuid,uuid,jsonb,text) is 'Preserves the exact current draft as immutable history and creates a new draft from a same-effect version, checking the caller snapshot under a parent lock.';

-- Caller wrapper for lossless history restoration.
create or replace function public.restore_effect_version(p_effect_id uuid, p_version_id uuid, p_current_version_id uuid, p_design jsonb, p_renderer text)
returns uuid language sql set search_path = '' as $$
  select private.restore_effect_version(p_effect_id,p_version_id,p_current_version_id,p_design,p_renderer);
$$;
comment on function public.restore_effect_version(uuid,uuid,uuid,jsonb,text) is 'Restores a same-effect history version while retaining the current draft snapshot.';

-- Locks the reviewed snapshot so note updates and lifecycle changes cannot overwrite concurrent edits.
create or replace function private.finish_effect_version(p_version_id uuid, p_design jsonb, p_note text, p_operation text, p_peak integer default null, p_peak_time_s numeric default null)
returns void language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  version public.effect_versions;
begin
  perform private.require_catalogue_editor();
  perform pg_advisory_xact_lock(hashtextextended('catalogue.publication',0));
  select * into version from public.effect_versions where id = p_version_id;
  if not found then raise exception using errcode = 'P0002', message = 'Effect version not found'; end if;
  perform 1 from public.effects where id = version.effect_id and status <> 'archived' for update;
  if not found then raise exception using errcode = '23514', message = 'Active firework required'; end if;
  select * into version from public.effect_versions where id = p_version_id for update;
  if version.status <> 'draft' or version.design is distinct from p_design then
    raise exception using errcode = '23514', message = 'The reviewed draft has changed. Reload before continuing';
  end if;
  update public.effect_versions set change_note = p_note where id = version.id;
  if p_operation = 'publish' then
    perform private.publish_measured_effect_version(version.id,p_design,p_peak,p_peak_time_s);
  elsif p_operation = 'review' then
    perform private.submit_effect_version(version.id,p_design,p_note);
  else
    raise exception using errcode = '22023', message = 'Unknown lifecycle operation';
  end if;
end;
$$;
comment on function private.finish_effect_version(uuid,jsonb,text,text,integer,numeric) is 'Atomically records the reviewed note and publishes or submits an exact draft snapshot; supplied peak time uses firing-relative seconds.';

-- Thin caller wrapper for the exact-snapshot lifecycle boundary.
create or replace function public.finish_effect_version(p_version_id uuid, p_design jsonb, p_note text, p_operation text, p_peak integer default null, p_peak_time_s numeric default null)
returns void language sql set search_path = '' as $$
  select private.finish_effect_version(p_version_id,p_design,p_note,p_operation,p_peak,p_peak_time_s);
$$;
comment on function public.finish_effect_version(uuid,jsonb,text,text,integer,numeric) is 'Records the review note and changes the exact draft lifecycle atomically.';
