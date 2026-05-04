-- Create products table for raw supplier inventory.
--
-- Distinction from catalogue_products:
--   products          = every product a supplier sells (populated from supplier data exports)
--   catalogue_products = products that have a firework animation / effect spec attached
--
-- supplier_inventory_items.product_id previously pointed at catalogue_products;
-- it now points at products since inventory tracks supplier stock, not animated catalogue entries.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  part_number text not null unique,
  name text not null,
  manufacturer text,
  firework_type text,
  firework_subtype text,
  category text,
  duration_seconds numeric(8,2),
  description text,
  source_table text,
  source_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_part_number_idx on public.products (part_number);
create index if not exists products_firework_type_idx on public.products (firework_type);
create index if not exists products_subtype_idx on public.products (firework_subtype)
  where firework_subtype is not null;

alter table public.products enable row level security;

create policy "products_select_authenticated" on public.products
  for select using (auth.uid() is not null);

create policy "products_admin_modify" on public.products
  for all using (public.has_permission(auth.uid(), 'admin.manage_catalogue'))
  with check (public.has_permission(auth.uid(), 'admin.manage_catalogue'));

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- Re-wire supplier_inventory_items.product_id to reference products instead of catalogue_products.
alter table public.supplier_inventory_items
  drop constraint if exists supplier_inventory_items_product_id_fkey;

alter table public.supplier_inventory_items
  add constraint supplier_inventory_items_product_id_fkey
  foreign key (product_id) references public.products(id) on delete set null;
