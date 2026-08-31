/** Guards for route-specific content caps and wide-grid behaviour. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('app discovery and show grids use their intended wide caps', () => {
  const home = read('app/(app)/home/page.tsx');
  const homeLoading = read('app/components/app/HomeLoadingSkeleton.tsx');
  const shows = read('app/(app)/shows/page.tsx');
  const showsLoading = read('app/(app)/shows/loading.tsx');

  assert.match(home, /max-w-\[1400px\]/);
  assert.match(homeLoading, /max-w-\[1400px\]/);
  assert.match(shows, /max-w-\[1600px\]/);
  assert.match(showsLoading, /max-w-\[1600px\]/);
  assert.match(shows, /lg:grid-cols-\[repeat\(auto-fill,minmax\(11rem,1fr\)\)\]/);
  assert.match(showsLoading, /lg:grid-cols-\[repeat\(auto-fill,minmax\(11rem,1fr\)\)\]/);
});

test('show workspaces expand while focused show content stays readable', () => {
  const chrome = read('app/(app)/shows/[id]/ShowDetailChrome.tsx');
  const shoppingList = read('app/(app)/shows/[id]/shopping-list/page.tsx');
  const guide = read('app/(app)/shows/[id]/show-guide/page.tsx');
  const skeletons = read('app/components/app/RouteSkeletons.tsx');

  assert.match(chrome, /max-w-\[1600px\]/);
  assert.match(shoppingList, /max-w-5xl/);
  assert.match(skeletons, /ShoppingListSkeleton[\s\S]*?max-w-5xl/);
  assert.match(guide, /max-w-3xl/);
});

test('admin routes cap data workspaces without constraining full-bleed editors', () => {
  const fluidRoutes = [
    'app/(admin)/admin/page.tsx',
    'app/(admin)/admin/catalogue/page.tsx',
    'app/(admin)/admin/effects/EffectsBrowser.tsx',
    'app/(admin)/admin/fireworks/page.tsx',
    'app/(admin)/admin/multishots/page.tsx',
    'app/(admin)/admin/roles/page.tsx',
    'app/(admin)/admin/show-presets/page.tsx',
    'app/(admin)/admin/suppliers/page.tsx',
    'app/(admin)/admin/users/page.tsx',
  ];

  for (const path of fluidRoutes) {
    assert.match(read(path), /max-w-\[1600px\]/, `${path} should use the fluid cap`);
  }

  assert.match(read('app/(admin)/admin/imports/page.tsx'), /max-w-\[1400px\]/);
  assert.match(read('app/(admin)/admin/prompts/page.tsx'), /max-w-\[1200px\]/);
  assert.match(read('app/(admin)/admin/users/[id]/page.tsx'), /max-w-\[1200px\]/);

  for (const path of [
    'app/(admin)/admin/fireworks/[id]/page.tsx',
    'app/(admin)/admin/effects/[id]/page.tsx',
    'app/(admin)/admin/effects/defaults/[id]/page.tsx',
  ]) {
    assert.doesNotMatch(read(path), /max-w-\[(?:1200|1400|1600)px\]/);
  }
});

test('cover poster grid stays responsive inside the curated-shows dialog', () => {
  const grid = read('app/(admin)/admin/show-presets/CoverPosterBackfill.tsx');

  assert.match(grid, /grid-cols-2/);
  assert.match(grid, /sm:grid-cols-3/);
  assert.match(grid, /lg:grid-cols-4/);
  // The dialog caps at ~64rem, so wider breakpoints must not add columns.
  assert.doesNotMatch(grid, /xl:grid-cols/);
});
