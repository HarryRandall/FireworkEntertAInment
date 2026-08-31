-- Seed default starter assortments for the retailer test account
-- (liam.maloney2403@gmail.com), so the retailer console has real,
-- non-empty data rather than an always-empty list. Mirrors FIR-178's
-- own precedent of seeding sample assortments from real, currently
-- listed catalogue items rather than fabricated ones. Idempotent: safe
-- to re-run, matches the retailer account by email once, upserts by
-- slug, and replaces each assortment's item list on every run.

do $$
declare
  v_retailer_id uuid;
  v_assortment_id uuid;
begin
  select id into v_retailer_id
  from public.users
  where lower(email) = 'liam.maloney2403@gmail.com';

  if v_retailer_id is null then
    raise notice 'Retailer test account not found by email, skipping default assortment seed.';
    return;
  end if;

  -- Backyard Sparkler Pack
  insert into public.assortments (slug, name, description, price_cents, created_by)
  values (
    'backyard-sparkler-pack',
    'Backyard Sparkler Pack',
    'A friendly starter bundle for a small backyard show.',
    4500,
    v_retailer_id
  )
  on conflict (slug) do update
  set name = excluded.name,
      description = excluded.description,
      price_cents = excluded.price_cents,
      created_by = excluded.created_by
  returning id into v_assortment_id;

  delete from public.assortment_items where assortment_id = v_assortment_id;
  insert into public.assortment_items (assortment_id, catalogue_item_id, quantity, sort_order)
  select v_assortment_id, id, qty, sort_order
  from (
    values
      ('ee577411-3680-4e2b-9322-78a6e14c3533'::uuid, 2, 0), -- Blue Sphere
      ('8c35b799-ac6a-4c3c-80a2-12d83452eb0a'::uuid, 2, 1), -- Comet Default
      ('5d4c8220-80ff-4677-92db-1dc9cccfecb0'::uuid, 1, 2)  -- Crackle Default
  ) as seed(id, qty, sort_order)
  where exists (select 1 from public.catalogue_items c where c.id = seed.id);

  -- Neighbourhood Show
  insert into public.assortments (slug, name, description, price_cents, created_by)
  values (
    'neighbourhood-show',
    'Neighbourhood Show',
    'A bigger mixed bundle for a street or block party.',
    9500,
    v_retailer_id
  )
  on conflict (slug) do update
  set name = excluded.name,
      description = excluded.description,
      price_cents = excluded.price_cents,
      created_by = excluded.created_by
  returning id into v_assortment_id;

  delete from public.assortment_items where assortment_id = v_assortment_id;
  insert into public.assortment_items (assortment_id, catalogue_item_id, quantity, sort_order)
  select v_assortment_id, id, qty, sort_order
  from (
    values
      ('7c9380e4-2b3b-435f-ad36-4af2a02ec8f5'::uuid, 2, 0), -- Brocade Default
      ('91cfc188-ecb9-4327-aba7-d30761aa9808'::uuid, 2, 1), -- Chrysanthemum Default
      ('4c3906bc-c634-48fc-ad81-c28287ef5fb2'::uuid, 2, 2), -- Crossette Default
      ('dba9aa43-f587-4d34-ace1-e0dfbdbc1e46'::uuid, 1, 3)  -- Comet Azure
  ) as seed(id, qty, sort_order)
  where exists (select 1 from public.catalogue_items c where c.id = seed.id);

  -- Grand Finale Bundle
  insert into public.assortments (slug, name, description, price_cents, created_by)
  values (
    'grand-finale-bundle',
    'Grand Finale Bundle',
    'Premium multishot pieces for a bigger closing show.',
    18000,
    v_retailer_id
  )
  on conflict (slug) do update
  set name = excluded.name,
      description = excluded.description,
      price_cents = excluded.price_cents,
      created_by = excluded.created_by
  returning id into v_assortment_id;

  delete from public.assortment_items where assortment_id = v_assortment_id;
  insert into public.assortment_items (assortment_id, catalogue_item_id, quantity, sort_order)
  select v_assortment_id, id, qty, sort_order
  from (
    values
      ('a80a43c4-51ed-4a58-987f-64628a7ce801'::uuid, 1, 0), -- DAMNED
      ('b6906a44-a2aa-40e6-ad04-55b021148f97'::uuid, 1, 1), -- DEMON
      ('11055f6b-fdaf-465a-bd74-3cd7350d4ed3'::uuid, 1, 2)  -- BODACIOUS
  ) as seed(id, qty, sort_order)
  where exists (select 1 from public.catalogue_items c where c.id = seed.id);
end $$;
