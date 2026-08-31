-- Add firework_subtype to catalogue_products.
-- Stores the shell/effect subtype (e.g. Willow, Brocade, Palm, Chrysanthemum)
-- as a separate indexed column rather than burying it in source_payload.

alter table public.catalogue_products
  add column if not exists firework_subtype text;

create index if not exists catalogue_products_subtype_idx
  on public.catalogue_products (firework_subtype)
  where firework_subtype is not null;

-- Add unique constraint on supplier_inventory_items(supplier_id, product_id)
-- so that upsert on conflict works correctly when re-seeding supplier stock.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'supplier_inventory_items_supplier_product_unique'
  ) then
    alter table public.supplier_inventory_items
      add constraint supplier_inventory_items_supplier_product_unique
      unique (supplier_id, product_id);
  end if;
end $$;
