/** Source guards for truthful and accessible shopping-list controls. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const source = readFileSync(join(process.cwd(), 'ui/shows/ShoppingListTable.tsx'), 'utf8');

test('shopping-list sorting exposes state and explicit button behaviour', () => {
  assert.match(source, /type="button"/);
  assert.match(source, /aria-pressed=\{active\}/);
  assert.match(source, /aria-label="Sort shopping list"/);
  assert.match(source, /currently \$\{direction === 'desc' \? 'descending' : 'ascending'\}/);
});

test('unknown prices are excluded explicitly instead of appearing as zero-cost products', () => {
  assert.match(source, /missingPriceCount = items\.filter/);
  assert.match(source, /Known-price subtotal/);
  assert.match(source, /with price TBC/);
  assert.match(source, /pricedItemCount > 0/);
  assert.match(source, /: 'Price TBC'/);
  assert.match(source, /<tfoot>/);
});

test('shopping-list tables contain horizontal scrolling and print all pages', () => {
  assert.match(source, /<DataTableShell>/);
  assert.match(source, /min-w-\[560px\]/);
  assert.match(source, /hidden print:table-row/);
  assert.match(source, /print:hidden/);
  assert.match(source, /<TablePagination/);
});
