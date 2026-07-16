-- Cue generation and shopping lists depend on the cheapest available supplier
-- price per catalogue item, and the firework-products payload is cached in a
-- shared (not per-user) cache key. Pricing therefore has to be readable by the
-- lowest-privilege reader, or an anonymous browse request would poison the
-- shared cache with "no price" for every product and generated shows would
-- fail for everyone.
--
-- Anonymous SELECT here is intentional: retail price and availability are
-- public shop data, in line with the public browse tables (`catalogue_items`,
-- `fireworks`, `multishots`). Only available, priced listings are exposed, and
-- the anon grant is column-limited so supplier operational data
-- (`supplier_sku`, `quantity_on_hand`, `updated_by`) stays permission-gated.
-- Inventory management policies are unchanged.

begin;

grant select (id, catalogue_item_id, price_cents, currency, available)
  on public.supplier_inventory_items
  to anon;

drop policy if exists supplier_inventory_select_public_prices
  on public.supplier_inventory_items;

create policy supplier_inventory_select_public_prices
  on public.supplier_inventory_items
  for select
  to anon, authenticated
  using (available = true and price_cents is not null);

commit;
