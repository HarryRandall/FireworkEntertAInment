/** Static guards for truthful, complete show exports. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

const root = process.cwd();

test('exports page offers responsive downloads only for shows with generated cues', () => {
  const page = readFileSync(join(root, 'app/(app)/exports/page.tsx'), 'utf8');
  const button = readFileSync(join(root, 'components/shows/ShowExportButton.tsx'), 'utf8');

  assert.match(page, /show\.cueCount > 0/);
  assert.match(page, /<ShowExportButton/);
  assert.match(page, /showSlug=\{show\.slug\}/);
  assert.match(button, /fetch\(`\/api\/shows\/\$\{encodeURIComponent\(showSlug\)\}\/export`/);
  assert.match(button, /setIsPreparing\(true\)/);
  assert.match(button, /loading=\{isPreparing\}/);
  assert.match(button, /Preparing export/);
  assert.match(button, /URL\.createObjectURL\(blob\)/);
  assert.match(button, /anchor\.download = filename/);
  assert.match(button, /toast\.error\('Could not export show'/);
  assert.match(page, /Finale 3D-compatible CSV/);
  assert.doesNotMatch(page, /No exported files yet|download history/i);
});

test('show export fails instead of silently dropping unresolved catalogue cues', () => {
  const route = readFileSync(join(root, 'app/api/shows/[id]/export/route.ts'), 'utf8');

  assert.match(route, /if \(cuesError\)/);
  assert.match(route, /missingCatalogueItemIds/);
  assert.match(route, /missingCatalogueItemIds\.length > 0/);
  assert.doesNotMatch(route, /\.filter\(\(c\) => catalogueItemById\.has/);
  assert.match(route, /'Cache-Control': 'private, no-store'/);
});
