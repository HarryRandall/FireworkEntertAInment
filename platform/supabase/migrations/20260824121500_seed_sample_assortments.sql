-- Seed two sample in-store assortments from real, currently-priced catalogue
-- items, for the Entry Point 2 kiosk mockup. Prices are the sum of the
-- member items' cheapest available supplier price at seed time, not a
-- rounded marketing figure.

with comet_trail as (
  insert into public.assortments (slug, name, description, price_cents, is_active)
  values (
    'comet-trail-assortment',
    'Comet Trail Assortment',
    'A colour-coded run of multishot cakes plus a specialty finisher, built for a mid-length backyard show.',
    15300,
    true
  )
  returning id
),
comet_trail_items (catalogue_item_id, quantity, sort_order) as (
  values
    ('abd88efa-94af-4958-aa8d-af3e4e3923e4'::uuid, 1, 0), -- Traffic Cone Orange
    ('9c3fb259-bece-4ff4-a71e-7b0b3026b06a'::uuid, 1, 1), -- Stop Sign Red
    ('ba8d4db8-ac10-4b3e-aa8f-ea1eea853e8a'::uuid, 1, 2), -- Electric Silver
    ('b3999a78-0ae3-459c-8181-14276d402c67'::uuid, 1, 3), -- Go For Green
    ('fe7438da-36d5-46ad-9b83-d3282a53da00'::uuid, 1, 4), -- Hectic
    ('8c8e052c-75d7-452a-a802-2cd0e75fe302'::uuid, 1, 5), -- Secret Stash
    ('47f5e9cd-86bb-454d-9dab-57c6d5df25db'::uuid, 1, 6)  -- Arthur Rozzi Gold Palm Tail to Brocade
)
insert into public.assortment_items (assortment_id, catalogue_item_id, quantity, sort_order)
select comet_trail.id, cti.catalogue_item_id, cti.quantity, cti.sort_order
from comet_trail cross join comet_trail_items cti;

with backyard_bash as (
  insert into public.assortments (slug, name, description, price_cents, is_active)
  values (
    'backyard-bash-assortment',
    'Backyard Bash Assortment',
    'A bright, high-contrast multishot lineup for a shorter, punchier backyard show.',
    14975,
    true
  )
  returning id
),
backyard_bash_items (catalogue_item_id, quantity, sort_order) as (
  values
    ('9f4816b1-3162-4c2a-ba4f-a637aff41489'::uuid, 1, 0), -- Hazard Yellow
    ('b3997444-9f12-4940-a0ec-11a0f403685d'::uuid, 1, 1), -- Hi-Vis Magenta
    ('07bd0bf5-3c90-4a83-a184-9d8ea65bae80'::uuid, 1, 2), -- High Voltage Gold
    ('efd947b8-35fd-4e91-a18b-8b473e7b0547'::uuid, 1, 3), -- Blue Steel
    ('30fc7cf8-2e2c-46c2-95cb-db0bda55c930'::uuid, 1, 4), -- Power Station
    ('7b01e5c4-5c68-423b-9fdf-fbf20f9e6f36'::uuid, 1, 5), -- Inside the Wormhole
    ('bf96b347-08a3-4487-ac26-c2cfd45086f4'::uuid, 1, 6)  -- Dripping With Color
)
insert into public.assortment_items (assortment_id, catalogue_item_id, quantity, sort_order)
select backyard_bash.id, bbi.catalogue_item_id, bbi.quantity, bbi.sort_order
from backyard_bash cross join backyard_bash_items bbi;
