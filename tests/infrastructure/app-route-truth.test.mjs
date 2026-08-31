/** Source guards for fail-closed app reads and stable page structure. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('home and show preview propagate data failures to the app error boundary', () => {
  const home = read('app/(app)/home/page.tsx');
  const preview = read('app/(app)/shows/[id]/preview/page.tsx');

  assert.match(home, /listShowTemplates\(\)/);
  assert.doesNotMatch(home, /listFireworkProducts\(\)/);
  assert.doesNotMatch(home, /ShowsNetworkError|specifications: \[\]|\.catch\(/);
  assert.match(preview, /const replayCuesPromise = listReplayCuesForShow\(show\.id\)/);
  assert.doesNotMatch(preview, /ShowsNetworkError|EMPTY_CUES|EMPTY_EXTRAS|\.catch\(/);
});

test('home and My shows retain one primary heading through loading', () => {
  const home = read('app/(app)/home/page.tsx');
  const homeLoading = read('components/home/HomeLoadingSkeleton.tsx');
  const shows = read('app/(app)/shows/page.tsx');
  const showsLoading = read('app/(app)/shows/loading.tsx');
  const showTabs = read('app/(app)/shows/[id]/ShowTabs.tsx');
  const showSections = read('app/(app)/shows/[id]/show-detail-sections.ts');

  assert.match(home, /<PromptHero headingLevel="h1"/);
  assert.match(homeLoading, /<PromptHero headingLevel="h1"/);
  for (const source of [shows, showsLoading]) {
    assert.match(source, /<h1[^>]*>My shows<\/h1>/);
    assert.match(source, /Search, preview and continue editing your saved show plans/);
  }
  assert.match(showsLoading, /<ShowTabs id=\{showSlug\} prefetch=\{false\} \/>/);
  assert.match(showTabs, /aria-label="Show sections"/);
  for (const label of ['Live preview', 'Shopping list', 'Show guide', 'Song context']) {
    assert.match(showSections, new RegExp(label));
  }
});
