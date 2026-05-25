#!/usr/bin/env npx tsx
/**
 * Seed script: Hammer & Anvil supplier catalogue.
 *
 * Upserts one `supplier_profiles` row, the full {@link PRODUCTS} fixture, and
 * a matching `supplier_inventory_items` row per product. Idempotent — safe
 * to re-run, since every write is conflict-targeted.
 *
 * Fixture data lives in `./seed/hammer-anvil/`:
 *   - `supplier.ts` — the supplier profile constant
 *   - `products.ts` — the (large) PRODUCTS array generated from the supplier
 *     spreadsheet. Regenerate from source rather than editing by hand.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx platform/scripts/seed-hammer-anvil.ts
 *
 * Or with a `.env.local`:
 *   npx dotenv -e .env.local -- npx tsx platform/scripts/seed-hammer-anvil.ts
 */

import { createClient } from '@supabase/supabase-js';
import { PRODUCTS } from './seed/hammer-anvil/products';
import { SUPPLIER } from './seed/hammer-anvil/supplier';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

async function main() {
  // 1. Upsert supplier — produces the id that inventory rows reference.
  console.log('Upserting supplier...');
  const { data: supplierRows, error: supplierErr } = await supabase
    .from('supplier_profiles')
    .upsert(SUPPLIER, { onConflict: 'slug' })
    .select('id');

  if (supplierErr) throw supplierErr;
  const supplierId = supplierRows![0].id as string;
  console.log(`  supplier_id: ${supplierId}`);

  // 2. Upsert catalogue products by part_number.
  console.log(`\nUpserting ${PRODUCTS.length} catalogue products...`);
  const productRows = PRODUCTS.map((p) => ({
    part_number: p.partNumber,
    name: p.name,
    manufacturer: 'HA',
    subtype: p.fireworkSubtype ?? p.partType ?? null,
    duration_seconds: p.durationSeconds != null ? parseFloat(String(p.durationSeconds)) : null,
    description: p.vdl,
  }));

  const { data: catalogueRows, error: catalogueErr } = await supabase
    .from('products')
    .upsert(productRows, { onConflict: 'part_number' })
    .select('id, part_number');

  if (catalogueErr) throw catalogueErr;
  console.log(`  inserted/updated ${catalogueRows!.length} products`);

  // Map part_number → product_id so we can link inventory below.
  const productIdByPartNumber = new Map(
    catalogueRows!.map((r: { id: string; part_number: string }) => [r.part_number, r.id]),
  );

  // 3. Upsert inventory items keyed by (supplier_id, product_id).
  console.log('\nUpserting inventory items...');
  const inventoryRows = PRODUCTS.map((p) => ({
    supplier_id: supplierId,
    product_id: productIdByPartNumber.get(p.partNumber)!,
    supplier_sku: p.manufacturerPartNumber ?? null,
    quantity_on_hand: p.qoh != null ? Number(p.qoh) : 0,
    // The spreadsheet doesn't carry pricing yet — leave null so the cheapest-
    // price calc in `lib/shows/shopping.server.ts` falls back to 0.
    price_cents: null,
    currency: 'AUD',
    available: true,
  }));

  const { error: inventoryErr } = await supabase
    .from('supplier_inventory_items')
    .upsert(inventoryRows, { onConflict: 'supplier_id,product_id' });

  if (inventoryErr) throw inventoryErr;
  console.log(`  inserted/updated ${inventoryRows.length} inventory items`);

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
