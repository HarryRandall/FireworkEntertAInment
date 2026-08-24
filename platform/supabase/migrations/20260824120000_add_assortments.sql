-- In-store assortments: priced bundles of catalogue_items sold physically in
-- a retailer's store. A scanned assortment QR locks a kiosk show's budget and
-- eligible catalogue pool to one of these bundles (see cue-generation runner).

create table public.assortments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  price_cents integer not null check (price_cents >= 0),
  cover_shader text,
  is_active boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.assortments is
  'Retailer-priced bundles of catalogue_items sold physically in-store. A kiosk show generated from a scanned assortment locks its budget and catalogue pool to one row here.';

create trigger assortments_set_updated_at
  before update on public.assortments
  for each row
  execute function public.set_updated_at();

create table public.assortment_items (
  id uuid primary key default gen_random_uuid(),
  assortment_id uuid not null references public.assortments(id) on delete cascade,
  catalogue_item_id uuid not null references public.catalogue_items(id) on delete restrict,
  quantity integer not null default 1 check (quantity >= 1),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assortment_id, catalogue_item_id)
);

comment on table public.assortment_items is
  'Member catalogue_items making up one assortment, with the quantity of each included in the bundle.';

create index assortment_items_assortment_id_idx
  on public.assortment_items (assortment_id, sort_order);
create index assortment_items_catalogue_item_id_idx
  on public.assortment_items (catalogue_item_id);

create trigger assortment_items_set_updated_at
  before update on public.assortment_items
  for each row
  execute function public.set_updated_at();

-- Kiosk shows carry the assortment they were generated from so the
-- cue-generation runner can constrain its catalogue pool to that bundle's
-- members instead of the full catalogue.
alter table public.shows
  add column assortment_id uuid references public.assortments(id) on delete set null;

create index shows_assortment_id_idx on public.shows (assortment_id) where assortment_id is not null;

alter table public.assortments enable row level security;
alter table public.assortment_items enable row level security;

insert into public.permissions (key, name, description, category)
values (
  'admin.manage_assortments',
  'Manage assortments',
  'Create and edit priced in-store assortments (bundles of catalogue items) and their member products.',
  'admin'
)
on conflict (key) do update
set name = excluded.name,
    description = excluded.description,
    category = excluded.category;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key = 'admin.manage_assortments'
where r.key = 'admin'
on conflict do nothing;

-- Single select policy per table (active-for-anyone OR admin-sees-drafts-too)
-- rather than two overlapping permissive policies, to avoid the redundant
-- per-row policy evaluation the security sweep flagged elsewhere
-- (supplier_inventory_items has exactly this duplication today).
grant select on public.assortments to anon;
create policy "assortments_select" on public.assortments
  for select using (
    is_active = true or public.current_user_has_permission('admin.manage_assortments')
  );

grant select on public.assortment_items to anon;
create policy "assortment_items_select" on public.assortment_items
  for select using (
    public.current_user_has_permission('admin.manage_assortments')
    or exists (
      select 1 from public.assortments a
      where a.id = assortment_id and a.is_active = true
    )
  );

create policy "assortments_admin_insert" on public.assortments
  for insert with check (public.current_user_has_permission('admin.manage_assortments'));
create policy "assortments_admin_update" on public.assortments
  for update using (public.current_user_has_permission('admin.manage_assortments'))
  with check (public.current_user_has_permission('admin.manage_assortments'));
create policy "assortments_admin_delete" on public.assortments
  for delete using (public.current_user_has_permission('admin.manage_assortments'));

create policy "assortment_items_admin_insert" on public.assortment_items
  for insert with check (public.current_user_has_permission('admin.manage_assortments'));
create policy "assortment_items_admin_update" on public.assortment_items
  for update using (public.current_user_has_permission('admin.manage_assortments'))
  with check (public.current_user_has_permission('admin.manage_assortments'));
create policy "assortment_items_admin_delete" on public.assortment_items
  for delete using (public.current_user_has_permission('admin.manage_assortments'));
