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

  // The purchasable filter must run before the type filter so every planner
  // (fast, beat, LLM) sees the same pool.
  const purchasableIndex = runner.indexOf('product.minPriceCents != null');
  const typesIndex = runner.indexOf('productMatchesTypes(product, allowedTypes)');
  assert.ok(purchasableIndex > 0, 'runner filters unpurchasable products');
  assert.ok(typesIndex > purchasableIndex, 'purchasable filter precedes firework-type filter');
  assert.match(runner, /No purchasable fireworks are available/);
});

test('firework products expose the cheapest available supplier price', () => {
  const catalogue = read('lib/shows/catalogue-products.ts');
  const reads = read('lib/shows/catalogue-products.server.ts');
  const domain = read('lib/show-domain.ts');

  assert.match(reads, /from\('supplier_inventory_items'\)/);
  assert.match(
    catalogue,
    /CATALOGUE_INVENTORY_SELECT = 'catalogue_item_id, price_cents, available'/,
  );
  assert.match(catalogue, /minPriceCents: cheapestAvailablePriceCents/);
  assert.match(domain, /minPriceCents\?: number \| null/);
  // Unavailable or unpriced listings must never count as purchasable.
  assert.match(catalogue, /if \(!row\.available \|\| row\.price_cents == null/);
});

test('product payload cache key versions with the pricing/occupancy payload', () => {
  const cacheKeys = read('lib/shows/cache-keys.ts');
  assert.match(cacheKeys, /firework-products:listed-v3/);
  assert.match(cacheKeys, /firework-catalogue-cards:listed-v3/);
});

test('catalogue product reads explicitly exclude unlisted entries for every caller', () => {
  const queries = read('lib/shows/queries.server.ts');
  const reads = read('lib/shows/catalogue-products.server.ts');
  // Both the whole-catalogue and the scoped id lookups go through the shared listed filter.
  assert.match(reads, /params\.listedOnly \? query\.eq\('is_listed', true\) : query/);
  assert.equal(reads.match(/listed\(supabase\.from\('catalogue_items'\)/g)?.length, 2);
  assert.match(queries, /listFireworkProducts = cache\([\s\S]*?listedOnly: true/);
});
