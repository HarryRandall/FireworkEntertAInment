-- Versioned retailer and shopper shows, QR routing and browser label metadata.
-- BEGIN GENERATED CUES SCHEMA
-- Generated from supabase/documents/cues.v1.json; use pnpm db:documents to refresh.
create or replace function private.cues_schema()
returns json
language sql
immutable
set search_path = ''
as $function$
  select $schema${"$schema":"http://json-schema.org/draft-07/schema#","title":"ShowCrafter show cues v1","type":"array","minItems":1,"items":{"type":"object","additionalProperties":false,"required":["t_ms","product_id","position","angle_deg"],"properties":{"t_ms":{"type":"integer","minimum":0},"product_id":{"type":"string","pattern":"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"},"position":{"type":"number"},"angle_deg":{"type":"number","minimum":-90,"maximum":90},"beat":{"type":["integer","null"],"minimum":0}}}}$schema$::json;
$function$;
comment on function private.cues_schema() is 'Returns the canonical v1 JSON Schema for database document validation.';
-- END GENERATED CUES SCHEMA

create table public.shows (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id),
  owner_id uuid references public.profiles(id),
  name text not null,
  origin text not null check (origin in ('planner','pack','manual','template')),
  status text not null default 'draft' check (status in ('draft','live','stock_issue','archived')),
  current_version_id uuid,
  soundtrack_track_id uuid,
  tags text[] not null default '{}', share_token text unique,
  archived_at timestamptz,
  check ((organisation_id is null) <> (owner_id is null)),
  check (status not in ('live','stock_issue') or current_version_id is not null),
  unique (id,organisation_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.shows enable row level security;
create index shows_organisation_id_idx on public.shows(organisation_id);
create index shows_owner_id_idx on public.shows(owner_id);
create trigger set_updated_at before update on public.shows
  for each row execute function private.set_updated_at();

create table public.show_versions (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows(id),
  organisation_id uuid references public.organisations(id),
  owner_id uuid references public.profiles(id),
  number int not null check (number > 0),
  cues jsonb not null check (extensions.jsonb_matches_schema(private.cues_schema(),cues)),
  soundtrack_analysis_id uuid,
  soundtrack_offset_ms int not null default 0,
  duration_ms int not null check (duration_ms >= 0),
  plan_session_id uuid,
  change_note text, created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check ((organisation_id is null) <> (owner_id is null)),
  unique (show_id,number), unique (show_id,id)
);
alter table public.show_versions enable row level security;
create index show_versions_organisation_id_idx on public.show_versions(organisation_id);
create index show_versions_owner_id_idx on public.show_versions(owner_id);

create table public.show_version_products (
  show_version_id uuid not null references public.show_versions(id),
  organisation_id uuid references public.organisations(id),
  owner_id uuid references public.profiles(id),
  product_id uuid not null references public.products(id),
  quantity smallint not null check (quantity > 0),
  check ((organisation_id is null) <> (owner_id is null)),
  primary key (show_version_id,product_id)
);
alter table public.show_version_products enable row level security;
create index show_version_products_organisation_id_idx on public.show_version_products(organisation_id);
create index show_version_products_owner_id_idx on public.show_version_products(owner_id);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id),
  name text not null, sale_period_id uuid references public.sale_periods(id),
  starts_on date, ends_on date,
  status text not null default 'scheduled' check (status in ('scheduled','live','ended','archived')),
  archived_at timestamptz,
  check (ends_on >= starts_on), unique (organisation_id,id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.campaigns enable row level security;
create index campaigns_organisation_id_idx on public.campaigns(organisation_id);
create trigger set_updated_at before update on public.campaigns
  for each row execute function private.set_updated_at();

create table public.qr_codes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id),
  store_id uuid,
  slug text not null unique check (slug ~ '^[A-Za-z0-9_-]+$'),
  target_type text not null check (target_type in ('product','pack','collection','show','planner','store')),
  target_id uuid, campaign_id uuid,
  placement text check (placement in ('shelf_strip','counter_card','window_poster','bag','end_cap','till','other')),
  label_text text,
  status text not null default 'live' check (status in ('live','paused','archived')),
  archived_at timestamptz, created_by uuid references public.profiles(id),
  check ((target_type in ('planner','store')) = (target_id is null)),
  foreign key (organisation_id,store_id) references public.stores(organisation_id,id),
  foreign key (organisation_id,campaign_id) references public.campaigns(organisation_id,id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.qr_codes enable row level security;
create index qr_codes_organisation_id_idx on public.qr_codes(organisation_id);
create index qr_codes_store_id_idx on public.qr_codes(store_id);
create trigger set_updated_at before update on public.qr_codes
  for each row execute function private.set_updated_at();

create table public.label_batches (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id),
  qr_code_ids uuid[] not null check (cardinality(qr_code_ids) > 0),
  size text not null check (size in ('shelf_strip','a6_card','a4_poster','till_sticker')),
  copies smallint not null default 1 check (copies > 0),
  pdf_media_id uuid references public.media(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.label_batches enable row level security;
create index label_batches_organisation_id_idx on public.label_batches(organisation_id);
create trigger set_updated_at before update on public.label_batches
  for each row execute function private.set_updated_at();

alter table public.shows add constraint shows_current_version_fk
  foreign key (id,current_version_id) references public.show_versions(show_id,id);
comment on column public.shows.soundtrack_track_id is 'Nullable UUID reference to public.music_tracks(id).';
comment on column public.show_versions.soundtrack_analysis_id is 'Nullable UUID reference to public.music_analyses(id).';
comment on column public.show_versions.plan_session_id is 'Nullable UUID reference to public.plan_sessions(id).';
comment on column public.show_versions.cues is 'Product launch cues: t_ms from show start, horizontal position in metres, angle_deg from vertical, optional beat index.';

-- Authorisation shared by history policies and the transactional save operation.
create function private.show_access(p_organisation uuid, p_owner uuid, p_write boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select case when p_organisation is null then
    p_owner = private.uid() and exists (select from public.profiles as profile
      where profile.id = p_owner and profile.status = 'active')
    when p_write then coalesce(private.staff_role() = 'super_admin',false)
      or private.can(p_organisation,'range.manage')
    else private.staff_role() is not null or p_organisation in (select private.org_ids('staff')) end;
$$;
comment on function private.show_access(uuid,uuid,boolean) is 'Checks active shopper ownership or retailer membership; show authoring requires range management rights.';
create policy shows_read on public.shows for select to authenticated
  using (private.show_access(organisation_id,owner_id,false));
create policy shows_insert on public.shows for insert to authenticated
  with check (private.show_access(organisation_id,owner_id,true));
create policy shows_update on public.shows for update to authenticated
  using (private.show_access(organisation_id,owner_id,true))
  with check (private.show_access(organisation_id,owner_id,true));
create policy show_versions_read on public.show_versions for select to authenticated
  using (private.show_access(organisation_id,owner_id,false));
create policy show_version_products_read on public.show_version_products for select to authenticated
  using (private.show_access(organisation_id,owner_id,false));
create policy campaigns_read on public.campaigns for select to authenticated
  using ((select private.staff_role()) is not null or (organisation_id in (select private.org_ids('staff'))));
create policy campaigns_insert on public.campaigns for insert to authenticated with check (((select private.staff_role()) = 'super_admin' or private.can(organisation_id,'qr.manage')));
create policy campaigns_update on public.campaigns for update to authenticated using (((select private.staff_role()) = 'super_admin' or private.can(organisation_id,'qr.manage'))) with check (((select private.staff_role()) = 'super_admin' or private.can(organisation_id,'qr.manage')));
create policy qr_codes_read on public.qr_codes for select to authenticated
  using ((select private.staff_role()) is not null or (private.store_access(organisation_id,store_id) or (store_id is null and organisation_id in (select private.org_ids('staff')))));
create policy qr_codes_insert on public.qr_codes for insert to authenticated with check (((select private.staff_role()) = 'super_admin' or private.can_store(organisation_id,store_id,'qr.manage')));
create policy qr_codes_update on public.qr_codes for update to authenticated using (((select private.staff_role()) = 'super_admin' or private.can_store(organisation_id,store_id,'qr.manage'))) with check (((select private.staff_role()) = 'super_admin' or private.can_store(organisation_id,store_id,'qr.manage')));
-- Batch access is the intersection of all QR store scopes, including store-restricted printers.
create function private.label_access(p_org uuid,p_codes uuid[],p_write boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select (case when p_write then coalesce(private.staff_role() = 'super_admin',false)
    else private.staff_role() is not null end)
    or (cardinality(p_codes) > 0 and not exists (
      select from unnest(p_codes) as entry(id) left join public.qr_codes as code on code.id = entry.id
      where code.id is null or code.organisation_id <> p_org or not (case when p_write
        then private.can_store(p_org,code.store_id,'labels.print')
        when code.store_id is null then p_org in (select private.org_ids('staff'))
        else private.store_access(p_org,code.store_id) end)));
$$;
comment on function private.label_access(uuid,uuid[],boolean) is 'Requires access to every QR store in the batch; label writes require print permission and foreign UUIDs fail closed.';
create policy label_batches_read on public.label_batches for select to authenticated
  using (private.label_access(organisation_id,qr_code_ids,false));
create policy label_batches_insert on public.label_batches for insert to authenticated
  with check (private.label_access(organisation_id,qr_code_ids,true));

-- History is immutable even for a trusted backend; versions are complete snapshots on save.
create function private.protect_show_history()
returns trigger language plpgsql set search_path = '' as $$
#variable_conflict error
begin
  raise exception using errcode = '23514', message = 'Show history is immutable';
end;
$$;
comment on function private.protect_show_history() is 'Rejects changes and deletion of saved show versions and their derived product quantities.';
create trigger protect_history before update or delete on public.show_versions
  for each row execute function private.protect_show_history();
create trigger protect_history before update or delete on public.show_version_products
  for each row execute function private.protect_show_history();

-- Protect tenancy and stable links independently of API grants.
create function private.validate_show_parent()
returns trigger language plpgsql set search_path = '' as $$
#variable_conflict error
begin
  if old.organisation_id is distinct from new.organisation_id or old.owner_id is distinct from new.owner_id then
    raise exception using errcode = '23514', message = 'Show ownership cannot change';
  end if;
  return new;
end;
$$;
comment on function private.validate_show_parent() is 'Keeps show history attached to its original retailer or shopper owner.';
create trigger validate_show_parent before update on public.shows
  for each row execute function private.validate_show_parent();

-- Polymorphic targets must exist in their own tenant; archived links retain their original slug.
create function private.validate_qr_code()
returns trigger language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  v_valid boolean;
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '23514', message = 'QR codes cannot be deleted';
  end if;
  if tg_op = 'UPDATE' and (new.id <> old.id or new.slug <> old.slug or new.organisation_id <> old.organisation_id
    or new.created_by is distinct from old.created_by) then
    raise exception using errcode = '23514', message = 'QR slug and ownership cannot change';
  end if;
  if tg_op = 'INSERT' and current_setting('role',true) = 'authenticated' then new.created_by := private.uid(); end if;
  if tg_op = 'UPDATE' and new.target_type is not distinct from old.target_type
    and new.target_id is not distinct from old.target_id then return new; end if;
  v_valid := case new.target_type
    when 'product' then exists (select from public.products as product where product.id = new.target_id and product.status = 'published' and product.kind <> 'pack')
    when 'pack' then exists (select from public.products as product where product.id = new.target_id and product.status = 'published' and product.kind = 'pack')
    when 'collection' then exists (select from public.collections as collection where collection.id = new.target_id and collection.organisation_id = new.organisation_id)
    when 'show' then exists (select from public.shows as show where show.id = new.target_id and show.organisation_id = new.organisation_id)
    when 'planner' then new.target_id is null
    when 'store' then new.target_id is null else false end;
  if not coalesce(v_valid,false) then
    raise exception using errcode = '23514', message = 'Invalid QR target or organisation';
  end if;
  return new;
end;
$$;
comment on function private.validate_qr_code() is 'Validates target type, publication and tenant; keeps QR slugs reserved permanently.';
create trigger validate_qr_code before insert or update or delete on public.qr_codes
  for each row execute function private.validate_qr_code();

-- Each label must refer to an accessible code and a PDF owned by this retailer.
create function private.validate_label_batch()
returns trigger language plpgsql security definer set search_path = '' as $$
#variable_conflict error
begin
  if current_setting('role',true) = 'authenticated'
    and not private.label_access(new.organisation_id,new.qr_code_ids,true) then
    raise exception using errcode = '42501', message = 'Label print permission required';
  end if;
  if exists (select from unnest(new.qr_code_ids) as entry(id)
    left join public.qr_codes as code on code.id = entry.id
    where code.id is null or code.organisation_id <> new.organisation_id) then
    raise exception using errcode = '23514', message = 'Label codes must belong to the retailer';
  end if;
  if current_setting('role',true) = 'authenticated' then new.created_by := private.uid(); end if;
  if new.pdf_media_id is not null and not exists (select from public.media as media
    where media.id = new.pdf_media_id and media.organisation_id = new.organisation_id
      and media.kind = 'document' and media.mime = 'application/pdf') then
    raise exception using errcode = '23514', message = 'Label PDF must belong to the retailer';
  end if;
  return new;
end;
$$;
comment on function private.validate_label_batch() is 'Rejects foreign or unknown QR UUIDs and media references in a label batch.';
create trigger validate_label_batch before insert or update on public.label_batches
  for each row execute function private.validate_label_batch();

-- Per-store price and availability are computed from current prices and movement balances.
create view public.show_store_status with (security_invoker = true) as
  select show.id as show_id, show.organisation_id, store.id as store_id,
    case when bool_and(price.product_id is not null) then sum(price.price_minor * needed.quantity) end as price_minor,
    min(price.currency::text)::char(3) as currency,
    bool_and(price.product_id is not null and not price.hidden and price.stock_qty >= needed.quantity
      and product.status = 'published') as available
  from public.shows as show join public.stores as store on store.organisation_id = show.organisation_id
  join public.show_version_products as needed on needed.show_version_id = show.current_version_id
  join public.products as product on product.id = needed.product_id
  left join public.store_prices as price on price.store_id = store.id and price.product_id = needed.product_id
  group by show.id,show.organisation_id,store.id;

-- Mark retailer shows with an unavailable product at every open store, and recover after replenishment.
create function private.recalculate_show_stock()
returns void language plpgsql security definer set search_path = '' as $$
#variable_conflict error
begin
  with desired as (
    select show.id,case when exists (
      select from public.show_version_products as needed
      where needed.show_version_id = show.current_version_id and not exists (
        select from public.store_prices as price join public.stores as store on store.id = price.store_id
        join public.products as product on product.id = price.product_id and product.status = 'published'
        where price.organisation_id = show.organisation_id and price.product_id = needed.product_id
          and store.status = 'open' and not price.hidden and price.stock_qty >= needed.quantity
      )) then 'stock_issue' else 'live' end as status
    from public.shows as show where show.organisation_id is not null and show.status in ('live','stock_issue')
  )
  update public.shows as show set status = desired.status from desired
    where show.id = desired.id and show.status is distinct from desired.status;
end;
$$;
comment on function private.recalculate_show_stock() is 'Recalculates live or stock_issue status from current range and stock for every retailer show; drafts and archived shows are untouched.';
-- Statement triggers and scheduled reconciliation share the same stock calculation.
create function private.refresh_show_stock()
returns trigger language plpgsql security definer set search_path = '' as $$
#variable_conflict error
begin
  perform private.recalculate_show_stock();
  return null;
end;
$$;
comment on function private.refresh_show_stock() is 'Delegates stock and range statement changes to the shared show stock calculation.';
create trigger refresh_show_stock after insert on public.stock_movements
  for each statement execute function private.refresh_show_stock();
create trigger refresh_show_stock after insert or update on public.store_items
  for each statement execute function private.refresh_show_stock();
create trigger refresh_show_stock after update on public.range_items
  for each statement execute function private.refresh_show_stock();
create trigger refresh_show_stock after update on public.stores
  for each statement execute function private.refresh_show_stock();
create trigger refresh_show_stock after update of status on public.products
  for each statement execute function private.refresh_show_stock();

-- Save a complete cue document and derived quantities atomically under a parent lock.
create function private.save_show(p_show uuid, p_cues jsonb, p_duration_ms int,
  p_soundtrack_analysis uuid, p_soundtrack_offset_ms int, p_plan_session uuid, p_change_note text)
returns uuid language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  v_show public.shows;
  v_version uuid;
  v_number int;
begin
  select show.* into v_show from public.shows as show where show.id = p_show for update;
  if v_show.id is null or not private.show_access(v_show.organisation_id,v_show.owner_id,true) then
    raise exception using errcode = '42501', message = 'Show authoring permission required';
  end if;
  if p_cues is null or not extensions.jsonb_matches_schema(private.cues_schema(),p_cues) or jsonb_array_length(p_cues) = 0 then
    raise exception using errcode = '23514', message = 'Invalid show cues';
  end if;
  if exists (select from jsonb_array_elements(p_cues) as cue(document)
    left join public.products as product on product.id = (cue.document->>'product_id')::uuid
    where product.status is distinct from 'published' or (cue.document->>'t_ms')::bigint > p_duration_ms
      or (v_show.organisation_id is not null and not exists (select from public.range_items as item
        where item.organisation_id = v_show.organisation_id and item.product_id = product.id))) then
    raise exception using errcode = '23514', message = 'Cues need published products in the retailer range and times within the show';
  end if;
  select coalesce(max(version.number),0) + 1 into v_number from public.show_versions as version where version.show_id = p_show;
  insert into public.show_versions(show_id,organisation_id,owner_id,number,cues,duration_ms,
    soundtrack_analysis_id,soundtrack_offset_ms,plan_session_id,change_note,created_by)
    values (p_show,v_show.organisation_id,v_show.owner_id,v_number,p_cues,p_duration_ms,
      p_soundtrack_analysis,p_soundtrack_offset_ms,p_plan_session,p_change_note,private.uid()) returning id into v_version;
  update public.shows set current_version_id = v_version where id = p_show;
  return v_version;
end;
$$;
comment on function private.save_show(uuid,jsonb,int,uuid,int,uuid,text) is 'Saves immutable launch cues (milliseconds from show start), numbering and product counts in one transaction. Authorisation and product membership are checked; returns the version UUID.';
create function public.save_show(p_show uuid,p_cues jsonb,p_duration_ms int,
  p_soundtrack_analysis uuid default null,p_soundtrack_offset_ms int default 0,
  p_plan_session uuid default null,p_change_note text default null)
returns uuid language sql set search_path = '' as $$
  select private.save_show(p_show,p_cues,p_duration_ms,p_soundtrack_analysis,p_soundtrack_offset_ms,p_plan_session,p_change_note);
$$;
comment on function public.save_show(uuid,jsonb,int,uuid,int,uuid,text) is 'Atomically saves a show cue snapshot and quantities; cue times and soundtrack offset are milliseconds. Returns its immutable version UUID.';

-- Restrict the public product slice to open stores, active retailers and confirmed market listings.
create function private.shopper_store_products(p_store uuid)
returns table(product_id uuid,name text,kind text,price_minor bigint,currency char(3),stock_qty int,
  noise_level smallint,min_safety_distance_m smallint,duration_ms int,colours text[],tags text[])
language sql stable security definer set search_path = '' as $$
  select product.id,product.name,product.kind,price.price_minor,price.currency,price.stock_qty,
    product.noise_level,product.min_safety_distance_m,product.duration_ms,product.colours,product.tags
  from public.stores as store
  join public.organisations as organisation on organisation.id = store.organisation_id
  join public.markets as market on market.code = store.market and market.enabled
  join public.store_prices as price on price.store_id = store.id and not price.hidden
  join public.products as product on product.id = price.product_id and product.status = 'published'
  join public.product_markets as listing on listing.product_id = product.id and listing.market = store.market
  where store.id = p_store and store.status = 'open' and organisation.status in ('active','trial')
    and listing.confirmed_at is not null and price.currency = market.currency;
$$;
comment on function private.shopper_store_products(uuid) is 'Returns visible published store products with confirmed market safety, minor-unit prices and movement-derived stock units; excludes private retailer fields.';

-- Playback reads current product and effect pointers each time, including selection-pack contents.
-- Resolve pack children at runtime, following their published product pointers.
create function private.product_playback(p_product uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
#variable_conflict error
declare
  v_playback jsonb;
begin
  select jsonb_build_object('id',product.id,'name',product.name,'kind',product.kind,
    'version_id',version.id,'composition',version.composition,
    'effects',coalesce((select jsonb_agg(jsonb_build_object('letter',binding.letter,
      'effect_id',effect.id,'version_id',design.id,'design',design.design,'renderer',design.renderer) order by binding.letter)
      from public.product_version_effects as binding
      join public.effects as effect on effect.id = binding.effect_id and effect.status = 'published'
      join public.effect_versions as design on design.id = effect.current_version_id and design.status = 'published'
      where binding.product_version_id = version.id),'[]'::jsonb),
    'pack_items',coalesce((select jsonb_agg(jsonb_build_object('quantity',item.quantity,
      'product',private.product_playback(item.item_id)) order by item.item_id)
      from public.pack_items as item where item.pack_id = product.id),'[]'::jsonb))
  into v_playback
  from public.products as product
  left join public.product_versions as version on version.id = product.current_version_id and version.status = 'published'
  where product.id = p_product and product.status = 'published';
  return v_playback;
end;
$$;
comment on function private.product_playback(uuid) is 'Returns only published playback documents from the latest product and effect versions; recursively includes immutable selection-pack contents.';

-- Evaluate collection membership against the current visible range and store prices.
create function private.collection_products(p_collection uuid,p_store uuid)
returns table(product_id uuid,sort smallint)
language sql stable security definer set search_path = '' as $$
  select product.product_id,coalesce(item.sort,0)::smallint
  from public.collections as collection
  join public.stores as store on store.organisation_id = collection.organisation_id
  join private.shopper_store_products(p_store) as product on true
  left join public.collection_items as item on item.collection_id = collection.id and item.product_id = product.product_id
  where collection.id = p_collection and store.id = p_store and collection.status = 'live'
    and ((collection.kind = 'manual' and item.product_id is not null)
      or (collection.kind = 'smart'
        and (not (coalesce(collection.rule,'{}'::jsonb) ? 'max_price_minor') or product.price_minor <= (coalesce(collection.rule,'{}'::jsonb)->>'max_price_minor')::bigint)
        and (not (coalesce(collection.rule,'{}'::jsonb) ? 'max_noise') or product.noise_level <= (coalesce(collection.rule,'{}'::jsonb)->>'max_noise')::smallint)
        and product.tags @> array(select jsonb_array_elements_text(coalesce(coalesce(collection.rule,'{}'::jsonb)->'tags','[]'::jsonb)))
        and (coalesce(jsonb_array_length(coalesce(collection.rule,'{}'::jsonb)->'colours'),0) = 0
          or product.colours && array(select jsonb_array_elements_text(coalesce(collection.rule,'{}'::jsonb)->'colours')))));
$$;
comment on function private.collection_products(uuid,uuid) is 'Resolves live manual membership or smart price/noise/tag/colour filters against a matching store; prices use minor units and tags require every requested tag.';

-- A public store page explicitly selects safe fields rather than serialising retailer rows.
create function private.store_page(p_store uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('store',jsonb_build_object('id',store.id,'name',store.name,
    'slug',store.slug,'market',store.market,'address',store.address,'postcode',store.postcode,
    'timezone',store.timezone,'opening_hours',store.opening_hours),
    'organisation',jsonb_build_object('id',organisation.id,'name',organisation.name),
    'products',coalesce((select jsonb_agg(to_jsonb(product) order by product.name,product.product_id)
      from private.shopper_store_products(p_store) as product),'[]'::jsonb),
    'collections',coalesce((select jsonb_agg(jsonb_build_object('id',collection.id,'name',collection.name,
      'slug',collection.slug,'kind',collection.kind,'rule',collection.rule,
      'product_ids',coalesce((select jsonb_agg(item.product_id order by item.sort,item.product_id)
        from private.collection_products(collection.id,p_store) as item),'[]'::jsonb)) order by collection.name)
      from public.collections as collection where collection.organisation_id = store.organisation_id and collection.status = 'live'),'[]'::jsonb),
    'shows',coalesce((select jsonb_agg(jsonb_build_object('id',show.id,'name',show.name) order by show.name)
      from public.shows as show where show.organisation_id = store.organisation_id and show.status in ('live','stock_issue')),'[]'::jsonb))
  from public.stores as store join public.organisations as organisation on organisation.id = store.organisation_id
  join public.markets as market on market.code = store.market and market.enabled
  where store.id = p_store and store.status = 'open' and organisation.status in ('active','trial');
$$;
comment on function private.store_page(uuid) is 'Returns the open store public page with visible range, live collections and retailer shows; closed stores and inactive retailers return null.';
create function public.store_page(p_store uuid)
returns jsonb language sql stable set search_path = '' as $$ select private.store_page(p_store); $$;
comment on function public.store_page(uuid) is 'Reads a restricted public store page through the privileged reader; returns null when unavailable.';

-- Missing, hidden or foreign-store products prevent playback rather than leaking their documents.
create function private.show_for_store(p_show uuid,p_store uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id',show.id,'name',show.name,'version_id',version.id,
    'cues',version.cues,'duration_ms',version.duration_ms,'soundtrack_track_id',show.soundtrack_track_id,
    'soundtrack_analysis_id',version.soundtrack_analysis_id,'soundtrack_offset_ms',version.soundtrack_offset_ms,
    'price_minor',(select sum(product.price_minor * needed.quantity) from public.show_version_products as needed
      join private.shopper_store_products(p_store) as product on product.product_id = needed.product_id
      where needed.show_version_id = version.id),
    'currency',(select min(product.currency::text) from private.shopper_store_products(p_store) as product
      join public.show_version_products as needed on needed.product_id = product.product_id where needed.show_version_id = version.id),
    'available',not exists (select from public.show_version_products as needed
      join private.shopper_store_products(p_store) as product on product.product_id = needed.product_id
      where needed.show_version_id = version.id and product.stock_qty < needed.quantity),
    'products',(select jsonb_agg(jsonb_build_object('quantity',needed.quantity,
      'product',private.product_playback(needed.product_id)) order by needed.product_id)
      from public.show_version_products as needed where needed.show_version_id = version.id))
  from public.shows as show join public.show_versions as version on version.id = show.current_version_id
  join public.stores as store on store.id = p_store
    and (store.organisation_id = show.organisation_id
      or (show.organisation_id is null and private.show_access(null,show.owner_id,false)))
  where show.id = p_show and store.id = p_store and show.status in ('live','stock_issue')
    and private.store_page(p_store) is not null
    and exists (select from public.show_version_products as needed where needed.show_version_id = version.id)
    and not exists (select from public.show_version_products as needed where needed.show_version_id = version.id
      and not exists (select from private.shopper_store_products(p_store) as product where product.product_id = needed.product_id));
$$;
comment on function private.show_for_store(uuid,uuid) is 'Returns retailer playback or the active caller''s own show with latest designs, minor-unit price and quantity-aware availability at an open store; inaccessible shows return null.';
create function public.show_for_store(p_show uuid,p_store uuid)
returns jsonb language sql stable set search_path = '' as $$ select private.show_for_store(p_show,p_store); $$;
comment on function public.show_for_store(uuid,uuid) is 'Reads restricted show playback at an open store; retailer shows are public and shopper shows require active ownership. Resolves the latest published designs.';

-- Recheck mutable target visibility for the selected store, independently of QR creation validity.
create function private.qr_target_visible(p_type text,p_target uuid,p_store uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case p_type
    when 'product' then exists (select from private.shopper_store_products(p_store) as product where product.product_id = p_target and product.kind <> 'pack')
    when 'pack' then exists (select from private.shopper_store_products(p_store) as product where product.product_id = p_target and product.kind = 'pack')
    when 'collection' then exists (select from public.collections as collection join public.stores as store
      on store.organisation_id = collection.organisation_id
      where collection.id = p_target and store.id = p_store and collection.status = 'live')
    when 'show' then private.show_for_store(p_target,p_store) is not null
    when 'planner' then true when 'store' then true else false end;
$$;
comment on function private.qr_target_visible(text,uuid,uuid) is 'Checks a QR target against visible catalogue, collection and show data at one store; unsupported types fail closed.';

-- Paused, archived and unavailable targets route to the store; organisation codes ask for a store.
create function private.resolve_qr(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
#variable_conflict error
declare
  v_code public.qr_codes;
  v_target_type text;
  v_target_id uuid;
  v_target_valid boolean;
begin
  select code.* into v_code from public.qr_codes as code
    join public.organisations as organisation on organisation.id = code.organisation_id
    where code.slug = p_slug and organisation.status in ('active','trial');
  if v_code.id is null then return null; end if;
  if v_code.store_id is null then
    return jsonb_build_object('qr_id',v_code.id,'organisation_id',v_code.organisation_id,'pick_store',true,
      'stores',coalesce((select jsonb_agg(jsonb_build_object('id',store.id,'name',store.name,
        'target_type',case when v_code.status = 'live' and private.qr_target_visible(v_code.target_type,v_code.target_id,store.id)
          then v_code.target_type else 'store' end,
        'target_id',case when v_code.status = 'live' and private.qr_target_visible(v_code.target_type,v_code.target_id,store.id)
          then v_code.target_id else null end) order by store.name)
        from public.stores as store where store.organisation_id = v_code.organisation_id
          and private.store_page(store.id) is not null),'[]'::jsonb));
  end if;
  if private.store_page(v_code.store_id) is null then return null; end if;
  v_target_type := v_code.target_type;
  v_target_id := v_code.target_id;
  v_target_valid := private.qr_target_visible(v_target_type,v_target_id,v_code.store_id);
  if v_code.status <> 'live' or not v_target_valid then v_target_type := 'store'; v_target_id := null; end if;
  return jsonb_build_object('qr_id',v_code.id,'store_id',v_code.store_id,
    'target_type',v_target_type,'target_id',v_target_id,'label_text',v_code.label_text);
end;
$$;
comment on function private.resolve_qr(text) is 'Resolves a permanent QR slug to visible public targets or a store fallback, and offers only open stores for organisation-wide codes.';
create function public.resolve_qr(p_slug text)
returns jsonb language sql stable set search_path = '' as $$ select private.resolve_qr(p_slug); $$;
comment on function public.resolve_qr(text) is 'Resolves a public QR slug; unknown or unavailable retailers return null, archived links fall back to the store.';

create trigger refresh_show_stock after update of current_version_id,status on public.shows
  for each row when (old.current_version_id is distinct from new.current_version_id or old.status is distinct from new.status)
  execute function private.refresh_show_stock();

-- Derive snapshot tenancy from the locked parent, including writes by trusted services.
create function private.validate_show_snapshot()
returns trigger language plpgsql set search_path = '' as $$
#variable_conflict error
declare
  v_show public.shows;
begin
  select show.* into v_show from public.shows as show where show.id = new.show_id for update;
  new.organisation_id := v_show.organisation_id;
  new.owner_id := v_show.owner_id;
  if not extensions.jsonb_matches_schema(private.cues_schema(),new.cues) then
    raise exception using errcode = '23514', message = 'Invalid show cues';
  end if;
  if exists (select from jsonb_array_elements(new.cues) as cue(document)
    left join public.products as product on product.id = (cue.document->>'product_id')::uuid
    where product.status is distinct from 'published' or (cue.document->>'t_ms')::bigint > new.duration_ms
      or (v_show.organisation_id is not null and not exists (select from public.range_items as item
        where item.organisation_id = v_show.organisation_id and item.product_id = product.id))) then
    raise exception using errcode = '23514', message = 'Invalid show product or cue time';
  end if;
  return new;
end;
$$;
comment on function private.validate_show_snapshot() is 'Copies immutable snapshot ownership from the locked show and validates publication, retailer range and millisecond cue bounds.';
create trigger validate_show_snapshot before insert on public.show_versions
  for each row execute function private.validate_show_snapshot();

-- Quantity and ownership have exactly one source: the containing immutable cue document.
create function private.derive_show_product()
returns trigger language plpgsql set search_path = '' as $$
#variable_conflict error
declare
  v_version public.show_versions;
begin
  select version.* into v_version from public.show_versions as version where version.id = new.show_version_id;
  new.organisation_id := v_version.organisation_id;
  new.owner_id := v_version.owner_id;
  select count(*) into new.quantity from jsonb_array_elements(v_version.cues) as cue(document)
    where (cue.document->>'product_id')::uuid = new.product_id;
  return new;
end;
$$;
comment on function private.derive_show_product() is 'Derives ownership and quantity in units from the saved cue document; unrelated products fail the positive quantity check.';
create trigger derive_show_product before insert on public.show_version_products
  for each row execute function private.derive_show_product();

-- Populate the complete index of products for every saved snapshot, including service inserts.
create function private.populate_show_products()
returns trigger language plpgsql set search_path = '' as $$
#variable_conflict error
begin
  insert into public.show_version_products(show_version_id,organisation_id,owner_id,product_id,quantity)
    select new.id,new.organisation_id,new.owner_id,(cue.document->>'product_id')::uuid,count(*)
    from jsonb_array_elements(new.cues) as cue(document) group by cue.document->>'product_id';
  return null;
end;
$$;
comment on function private.populate_show_products() is 'Builds the entire immutable product-quantity index from a new cue snapshot in the same transaction.';
create trigger populate_show_products after insert on public.show_versions
  for each row execute function private.populate_show_products();
