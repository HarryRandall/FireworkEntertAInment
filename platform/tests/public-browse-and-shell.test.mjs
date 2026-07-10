/** Focused guards for public browse routing and reachable shared-shell navigation. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('shared shells expose a mobile trigger outside the closed sidebar', () => {
  const appShell = read('app/components/app/AppShell.tsx');
  const adminShell = read('app/components/admin/AdminShell.tsx');
  const sidebar = read('components/ui/sidebar.tsx');

  assert.match(appShell, /aria-label="Open navigation"/);
  assert.match(appShell, /home && 'md:hidden'/);
  assert.doesNotMatch(appShell, /if \(isHomePath\(pathname\)\)[\s\S]*?return null/);
  assert.match(adminShell, /aria-label="Open admin navigation"/);
  assert.match(sidebar, /React\.ComponentProps<'div'>/);
  assert.match(sidebar, /<div\s+data-slot="sidebar-inset"/);
  assert.doesNotMatch(sidebar, /<main\s+data-slot="sidebar-inset"/);
  assert.equal(appShell.match(/<main\b/g)?.length, 1);
  assert.equal(adminShell.match(/<main\b/g)?.length, 1);
});

test('home discovery does not depend on the user already having a show', () => {
  const home = read('app/(app)/home/page.tsx');
  const collections = read('app/components/app/HomeDiscoverySections.tsx');

  assert.match(home, /<HomeFeaturedShows/);
  assert.match(home, /<HomeCollectionsSection \/>/);
  assert.match(home, /listShowTemplates/);
  assert.doesNotMatch(home, /hasShows|EmptyShowsPanel/);
  assert.match(collections, /href: '\/library\?sort=budget'/);

  const library = read('app/(browse)/library/page.tsx');
  assert.match(library, /value === 'budget'/);
  assert.match(library, /budget: 'Highest budgets'/);
  assert.match(library, /b\.totalCents - a\.totalCents/);
  assert.match(library, /templates: templatesForShelf\(templates, sort\)/);
  assert.match(library, /const SHOWS_PER_SHELF = 12/);
  assert.match(library, /if \(sort === 'featured'\) return template\.isFeatured/);
  assert.match(library, /if \(sort === 'shortest'\)/);
  assert.doesNotMatch(library, /usedTemplateIds|fallbackTemplates|sort=hot|hashString/);
});

test('public browse routes retain page-level chrome while their data loads', () => {
  const library = read('app/(browse)/library/page.tsx');
  const libraryLoading = read('app/(browse)/library/loading.tsx');
  const catalogue = read('app/(browse)/catalogue/page.tsx');

  assert.match(library, /<h1[^>]*>Explore shows<\/h1>/);
  assert.match(libraryLoading, /<h1[^>]*>Explore shows<\/h1>/);
  assert.match(catalogue, /<h1[^>]*>Firework catalogue<\/h1>/);
});

test('route error boundaries do not render backend error messages', () => {
  for (const path of ['app/(app)/error.tsx', 'app/(admin)/error.tsx', 'app/(browse)/error.tsx']) {
    const source = read(path);
    assert.doesNotMatch(source, /error\.message/);
    assert.match(source, /Try again|try again/);
    assert.match(source, /onClick=\{reset\}/);
  }
});

test('catalogue failures reach the shared browse retry boundary', () => {
  const catalogue = read('app/(browse)/catalogue/page.tsx');

  assert.doesNotMatch(catalogue, /ShowsNetworkError/);
  assert.doesNotMatch(catalogue, /temporarily unavailable/);
  assert.match(catalogue, /await listFireworkProducts/);
  assert.match(catalogue, /bg-card min-w-0 rounded-xl/);
  assert.match(catalogue, /\[overflow-wrap:anywhere\]/);
});
