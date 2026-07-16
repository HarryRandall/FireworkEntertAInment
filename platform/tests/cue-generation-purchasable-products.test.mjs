/** Static guards: generated shows must only schedule purchasable products. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('cue generation restricts the planning pool to priced supplier inventory', () => {
  const runner = read('lib/cue-generation/runner.server.ts');

  // The purchasable filter must run before the type and launch-position
  // filters so every planner (fast, beat, LLM) sees the same pool.
  const purchasableIndex = runner.indexOf('product.minPriceCents != null');
  const fitsIndex = runner.indexOf('productFitsLaunchPositions(product, maxTubes)');
  const typesIndex = runner.indexOf('productMatchesTypes(product, allowedTypes)');
  assert.ok(purchasableIndex > 0, 'runner filters unpurchasable products');
  assert.ok(fitsIndex > purchasableIndex, 'purchasable filter precedes launch-position filter');
  assert.ok(typesIndex > purchasableIndex, 'purchasable filter precedes firework-type filter');
  assert.match(runner, /No purchasable fireworks are available/);
});

test('firework products expose the cheapest available supplier price', () => {
  const queries = read('lib/shows/queries.server.ts');
  const domain = read('lib/show-domain.ts');

  assert.match(queries, /supplier_inventory_items \(price_cents, available\)/);
  assert.match(queries, /cheapestAvailablePriceCents/);
  assert.match(domain, /minPriceCents\?: number \| null/);
  // Unavailable or unpriced listings must never count as purchasable.
  assert.match(queries, /if \(!row\.available \|\| row\.price_cents == null/);
});

test('product payload cache key versions with the pricing/occupancy payload', () => {
  const cacheKeys = read('lib/shows/cache-keys.ts');
  assert.match(cacheKeys, /firework-products:preview-v2/);
  assert.match(cacheKeys, /firework-catalogue-cards:preview-v2/);
});

test('public supplier pricing migration stays column-limited for anon', () => {
  const migration = read('supabase/migrations/20260716001633_expose_public_supplier_prices.sql');
  assert.match(
    migration,
    /grant select \(id, catalogue_item_id, price_cents, currency, available\)/,
  );
  assert.match(migration, /to anon, authenticated/);
  assert.match(migration, /using \(available = true and price_cents is not null\)/);
  assert.doesNotMatch(migration, /grant select on public\.supplier_inventory_items/i);
});
