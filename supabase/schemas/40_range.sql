-- Retailer pricing, curated collections and movement-derived stock. Lists do not reserve stock.
create table public.range_items (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id),
  product_id uuid not null references public.products(id),
  price_minor bigint not null check (price_minor >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  hidden boolean not null default false,
  added_via text check (added_via in ('starter','catalogue','import','till')),
  unique (organisation_id, product_id), unique (organisation_id, id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.range_items enable row level security;
create trigger set_updated_at before update on public.range_items
  for each row execute function private.set_updated_at();
create index range_items_organisation_id_idx on public.range_items(organisation_id);
create policy range_items_read on public.range_items for select to authenticated
  using ((select private.staff_role()) is not null or organisation_id in (select private.org_ids('staff')));
create policy range_items_insert on public.range_items for insert to authenticated with check (((select private.staff_role()) = 'super_admin' or private.can(organisation_id,'range.manage')));
create policy range_items_update on public.range_items for update to authenticated using (((select private.staff_role()) = 'super_admin' or private.can(organisation_id,'range.manage'))) with check (((select private.staff_role()) = 'super_admin' or private.can(organisation_id,'range.manage')));

create table public.store_items (
  store_id uuid not null,
  range_item_id uuid not null,
  organisation_id uuid not null references public.organisations(id),
  price_override_minor bigint check (price_override_minor >= 0),
  low_stock_at int not null default 5 check (low_stock_at >= 0),
  aisle text, bay text, till_sku text,
  hidden boolean not null default false,
  primary key (store_id, range_item_id),
  unique (organisation_id, store_id, range_item_id),
  foreign key (organisation_id, store_id) references public.stores(organisation_id,id),
  foreign key (organisation_id, range_item_id) references public.range_items(organisation_id,id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.store_items enable row level security;
create trigger set_updated_at before update on public.store_items
  for each row execute function private.set_updated_at();
create index store_items_organisation_id_idx on public.store_items(organisation_id);
create index store_items_store_id_idx on public.store_items(store_id);
create policy store_items_read on public.store_items for select to authenticated
  using ((select private.staff_role()) is not null or private.store_access(organisation_id, store_id));
create policy store_items_insert on public.store_items for insert to authenticated with check (((select private.staff_role()) = 'super_admin' or private.can_store(organisation_id,store_id,'prices.manage')));
create policy store_items_update on public.store_items for update to authenticated using (((select private.staff_role()) = 'super_admin' or private.can_store(organisation_id,store_id,'prices.manage'))) with check (((select private.staff_role()) = 'super_admin' or private.can_store(organisation_id,store_id,'prices.manage')));

create table public.stock_movements (
  id bigint generated always as identity primary key,
  organisation_id uuid not null references public.organisations(id),
  store_id uuid not null, range_item_id uuid not null,
  delta int not null, qty_after int not null check (qty_after >= 0),
  source text not null check (source in ('manual','csv','till')), ref text,
  at timestamptz not null default now(),
  foreign key (organisation_id, store_id, range_item_id)
    references public.store_items(organisation_id,store_id,range_item_id)
);
alter table public.stock_movements enable row level security;
create index stock_movements_organisation_id_idx on public.stock_movements(organisation_id);
create index stock_movements_store_id_idx on public.stock_movements(store_id);
create index stock_movements_balance_idx on public.stock_movements(store_id,range_item_id,id desc);
create policy stock_movements_read on public.stock_movements for select to authenticated
  using ((select private.staff_role()) is not null or private.store_access(organisation_id, store_id));

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id),
  name text not null, slug text not null,
  kind text not null check (kind in ('manual','smart')),
  rule jsonb check (extensions.jsonb_matches_schema(
    '{"type":"object","additionalProperties":false,"properties":{"max_price_minor":{"type":"integer","minimum":0,"maximum":9223372036854775807},"max_noise":{"type":"integer","minimum":0,"maximum":3},"tags":{"type":"array","items":{"type":"string"}},"colours":{"type":"array","items":{"type":"string"}}}}'::json,rule)),
  status text not null default 'live' check (status in ('draft','live','archived')),
  archived_at timestamptz,
  unique (organisation_id,slug), unique (organisation_id,id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.collections enable row level security;
create trigger set_updated_at before update on public.collections
  for each row execute function private.set_updated_at();
create index collections_organisation_id_idx on public.collections(organisation_id);
create policy collections_read on public.collections for select to authenticated
  using ((select private.staff_role()) is not null or organisation_id in (select private.org_ids('staff')));
create policy collections_insert on public.collections for insert to authenticated with check (((select private.staff_role()) = 'super_admin' or private.can(organisation_id,'range.manage')));
create policy collections_update on public.collections for update to authenticated using (((select private.staff_role()) = 'super_admin' or private.can(organisation_id,'range.manage'))) with check (((select private.staff_role()) = 'super_admin' or private.can(organisation_id,'range.manage')));

create table public.collection_items (
  collection_id uuid not null, product_id uuid not null references public.products(id),
  organisation_id uuid not null references public.organisations(id),
  sort smallint not null default 0,
  primary key (collection_id,product_id),
  foreign key (organisation_id,collection_id) references public.collections(organisation_id,id),
  foreign key (organisation_id,product_id) references public.range_items(organisation_id,product_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.collection_items enable row level security;
create trigger set_updated_at before update on public.collection_items
  for each row execute function private.set_updated_at();
create index collection_items_organisation_id_idx on public.collection_items(organisation_id);
create policy collection_items_read on public.collection_items for select to authenticated
  using ((select private.staff_role()) is not null or organisation_id in (select private.org_ids('staff')));
create policy collection_items_insert on public.collection_items for insert to authenticated with check (((select private.staff_role()) = 'super_admin' or private.can(organisation_id,'range.manage')));
create policy collection_items_update on public.collection_items for update to authenticated using (((select private.staff_role()) = 'super_admin' or private.can(organisation_id,'range.manage'))) with check (((select private.staff_role()) = 'super_admin' or private.can(organisation_id,'range.manage')));
create policy collection_items_delete on public.collection_items for delete to authenticated using (((select private.staff_role()) = 'super_admin' or private.can(organisation_id,'range.manage')));

comment on column public.collections.rule is 'Smart collection filters: minor-unit maximum price bounded by SQL bigint, maximum supplier noise on the catalogue 0 to 3 scale, required tags and any matching colour.';
comment on column public.store_items.low_stock_at is 'Units remaining at which the retailer sees a low-stock warning; default five units is a schema-plan product setting.';

-- Invoker views retain the caller's RLS; public pages use the restricted private reader instead.
create view public.store_prices with (security_invoker = true) as
  select si.organisation_id, si.store_id, ri.product_id, si.range_item_id,
    coalesce(si.price_override_minor,ri.price_minor) as price_minor, ri.currency,
    coalesce(stock.quantity,0)::int as stock_qty, stock.source as stock_source,
    stock.updated_at as stock_updated_at, (ri.hidden or si.hidden) as hidden
  from public.store_items as si join public.range_items as ri on ri.id = si.range_item_id
  left join lateral (
    select sum(movement.delta) as quantity,
      (array_agg(movement.source order by movement.id desc))[1] as source,
      max(movement.at) as updated_at
    from public.stock_movements as movement
    where movement.store_id = si.store_id and movement.range_item_id = si.range_item_id
  ) as stock on true;

-- Lock the stock item so concurrent increments cannot both observe the same balance.
create function private.check_stock_movement()
returns trigger language plpgsql set search_path = '' as $$
#variable_conflict error
declare
  v_quantity bigint;
begin
  if tg_op <> 'INSERT' then
    raise exception using errcode = '23514', message = 'Stock history is append-only';
  end if;
  perform 1 from public.store_items as item
    where item.store_id = new.store_id and item.range_item_id = new.range_item_id for update;
  select coalesce(sum(movement.delta),0) + new.delta into v_quantity
    from public.stock_movements as movement
    where movement.store_id = new.store_id and movement.range_item_id = new.range_item_id;
  new.qty_after := v_quantity;
  new.at := now();
  return new;
end;
$$;
comment on function private.check_stock_movement() is 'Serialises stock deltas in units and derives the resulting non-negative balance; history updates and deletion are rejected.';
create trigger check_stock_movement before insert or update or delete on public.stock_movements
  for each row execute function private.check_stock_movement();

-- Append a CSV or manual stock change in units, never a reservation or editable balance.
create function private.record_stock(p_store uuid, p_range_item uuid, p_delta int, p_source text, p_ref text)
returns bigint language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  v_organisation uuid;
  v_movement bigint;
begin
  select item.organisation_id into v_organisation from public.store_items as item
    where item.store_id = p_store and item.range_item_id = p_range_item for update;
  if v_organisation is null or not (coalesce(private.staff_role() = 'super_admin',false)
    or private.can_store(v_organisation,p_store,'range.manage')) then
    raise exception using errcode = '42501', message = 'Stock management permission required';
  end if;
  if p_source is null or p_source not in ('manual','csv') then
    raise exception using errcode = '23514', message = 'Stock source must be manual or csv';
  end if;
  insert into public.stock_movements(organisation_id,store_id,range_item_id,delta,qty_after,source,ref)
    values (v_organisation,p_store,p_range_item,p_delta,0,p_source,p_ref) returning id into v_movement;
  return v_movement;
end;
$$;
comment on function private.record_stock(uuid,uuid,int,text,text) is 'Appends a signed delta in units for an authorised store; negative resulting stock fails atomically. Returns the movement ID.';
create function public.record_stock(p_store uuid, p_range_item uuid, p_delta int, p_source text, p_ref text default null)
returns bigint language sql set search_path = '' as $$
  select private.record_stock(p_store,p_range_item,p_delta,p_source,p_ref);
$$;
comment on function public.record_stock(uuid,uuid,int,text,text) is 'Records a CSV or manual delta in units at an authorised store and returns its immutable movement ID.';
