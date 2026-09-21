/** Static-analysis "grep the source" test guarding the recommendations / library schema invariants. */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

const root = process.cwd();

test('show library routes and clone action exist', () => {
  assert.equal(existsSync(join(root, 'app/(browse)/library/page.tsx')), true);
  assert.equal(existsSync(join(root, 'app/(browse)/library/[id]/page.tsx')), true);
  assert.equal(existsSync(join(root, 'app/(browse)/library/loading.tsx')), true);
  assert.equal(existsSync(join(root, 'app/(app)/recommendations/page.tsx')), true);
  assert.equal(existsSync(join(root, 'app/(app)/recommendations/[id]/page.tsx')), true);
  const legacyPage = readFileSync(join(root, 'app/(app)/recommendations/page.tsx'), 'utf8');
  const legacyDetail = readFileSync(join(root, 'app/(app)/recommendations/[id]/page.tsx'), 'utf8');
  assert.match(legacyPage, /redirect\(['"]\/library['"]\)/);
  assert.match(legacyDetail, /redirect\(`\/library\/\$\{id\}`\)/);
  const action = readFileSync(join(root, 'app/actions/show-templates.ts'), 'utf8');
  assert.match(action, /cloneShowTemplateAction/);
  assert.match(action, /show_timeline_items/);
});

test('show library templates use semi-static caching', () => {
  const cacheKeys = readFileSync(join(root, 'lib/show-templates/cache.server.ts'), 'utf8');
  const templates = readFileSync(join(root, 'lib/show-templates/queries.server.ts'), 'utf8');
  assert.match(cacheKeys, /SHOW_TEMPLATES_TTL_SECONDS/);
  assert.match(cacheKeys, /getShowTemplatesCacheKey/);
  assert.match(cacheKeys, /show-templates:database-v4/);
  assert.match(templates, /getCachedJson<ShowTemplateSummary\[]>/);
  assert.match(templates, /const cacheKey = getShowTemplatesCacheKey\(\)/);
  assert.match(templates, /setCachedJson\(cacheKey, mapped/);
});

test('main navigation includes show library', () => {
  const navigation = readFileSync(join(root, 'ui/shell/app-shell-navigation.ts'), 'utf8');
  assert.match(navigation, /href: '\/library', label: 'Explore'/);
  assert.doesNotMatch(navigation, /label: 'Library'/);
  assert.doesNotMatch(navigation, /Recommendations/);
});
