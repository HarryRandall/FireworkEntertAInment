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
  const appShell = read('components/shell/AppShell.tsx');
  const adminShell = read('components/admin/AdminShell.tsx');
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
  const collections = read('components/home/HomeDiscoverySections.tsx');

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
  assert.match(library, /usedTemplateIds/);
  assert.match(library, /ShowTemplateSummary/);
  assert.match(library, /usedCompositionSignatures/);
  assert.match(library, /template\.compositionSignature/);
  assert.doesNotMatch(library, /previewCues/);
  assert.doesNotMatch(library, /fallbackTemplates|sort=hot|hashString/);
});

test('public browse routes retain page-level chrome while their data loads', () => {
  const library = read('app/(browse)/library/page.tsx');
  const libraryLoading = read('app/(browse)/library/loading.tsx');
  const catalogue = read('app/(browse)/catalogue/page.tsx');
  const catalogueLoading = read('app/(browse)/catalogue/loading.tsx');
  const catalogueSkeleton = read('app/(browse)/catalogue/CatalogueSkeleton.tsx');

  assert.match(library, /<h1[^>]*>Explore shows<\/h1>/);
  assert.match(library, /fallback=\{/);
  assert.match(library, /LibraryCardsSkeleton/);
  assert.match(library, /max-w-\[1600px\]/);
  assert.match(libraryLoading, /max-w-\[1600px\]/);
  assert.match(catalogue, /<h1[^>]*>Firework catalogue<\/h1>/);
  assert.match(catalogue, /max-w-\[1600px\]/);
  assert.match(catalogueLoading, /max-w-\[1600px\]/);
  assert.match(catalogue, /2xl:grid-cols-4/);
  assert.match(catalogueSkeleton, /FireworkBrowseGridSkeleton/);
  assert.match(catalogueSkeleton, /count=\{CATALOGUE_PAGE_SIZE\}/);
  assert.match(catalogue, /<FireworkBrowsePreviewProvider>/);
  assert.match(catalogue, /<FireworkBrowseCard/);
  assert.match(catalogue, /\/api\/catalogue\/\$\{product\.id\}\/preview/);
  assert.match(catalogue, /withFireworkPreviewRevision\(/);
  assert.match(catalogue, /product\.previewImageRevision/);
  assert.match(
    catalogue,
    /persistedPosterUrl=\{fireworkPreviewImageUrl\(product\.previewImagePath\)\}/,
  );
  assert.doesNotMatch(catalogue, /\bpersistPoster\b/);
  assert.match(catalogue, /\(product\.shotCount \?\? 1\)\.toLocaleString\(\)/);
  assert.match(catalogue, /formatDuration\(product\.durationSeconds\)/);
  assert.doesNotMatch(catalogue, /preview=\{/);
  assert.doesNotMatch(catalogue, /AdminEffectPreview/);
  assert.doesNotMatch(catalogue, /CatalogueMeta/);
  assert.doesNotMatch(catalogue, /aria-label="Colour palette"/);
  assert.doesNotMatch(catalogue, /product\.variant\?\.colorPalette\.slice/);
  assert.doesNotMatch(catalogue, /\{product\.description\s*\?\?/);
  assert.doesNotMatch(catalogue, /product\.heightMeters \?/);
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
  assert.match(catalogue, /FireworkBrowseCard/);
  assert.match(catalogue, /line-clamp-2 text-sm leading-5 font-semibold/);
});
