/** Static guards for intent-loaded Explore preview specifications. */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('the Explore shelf does not serialise the full firework catalogue', () => {
  const libraryPage = read('app/(browse)/library/page.tsx');
  const homePage = read('app/(app)/home/page.tsx');

  assert.doesNotMatch(libraryPage, /listFireworkProducts/);
  assert.match(libraryPage, /const templates = await listShowTemplates\(\)/);
  assert.match(libraryPage, /<ExplorePreviewProvider>/);
  assert.doesNotMatch(libraryPage, /ExplorePreviewProvider specifications=/);
  assert.doesNotMatch(homePage, /ExplorePreviewProvider specifications=/);
});

test('the public preview route returns only specifications resolved from a published template', () => {
  const routePath = 'app/api/library/[slug]/preview/route.ts';
  assert.equal(existsSync(join(root, routePath)), true);

  const route = read(routePath);
  assert.match(route, /getShowTemplateBySlug\(slug\)/);
  assert.match(route, /if \(!template\?\.isPublished\)/);
  assert.match(route, /listFireworkProducts\(\)/);
  assert.match(route, /cue\.catalogueItemId/);
  assert.match(route, /cue\.catalogueItemSlug/);
  assert.match(route, /cue\.fireworkSlug/);
  assert.match(route, /specification\.variant\?\.slug/);
  assert.match(route, /specification\.baseEffect\?\.slug/);
  assert.match(route, /if \(!specification\)/);
  assert.match(route, /Published Explore show contains an unresolved preview cue/);
  assert.match(route, /referencedIds\.has\(specification\.id\)/);
  assert.match(route, /return response\(\{ specifications \}\)/);
  assert.match(route, /'Cache-Control': 'no-store, max-age=0'/);
  assert.doesNotMatch(route, /return response\(\{ template/);
});

test('the shared preview loads after intent, caches by slug and stale-guards cancellation', () => {
  const context = read('app/components/app/ExplorePreviewContext.tsx');

  assert.match(context, /setTimeout\(\(\) => \{[\s\S]*?confirmPreview\(/);
  assert.match(context, /`\/api\/library\/\$\{encodeURIComponent\(slug\)\}\/preview`/);
  assert.match(context, /new Map<string, FireworkSpecification\[\]>\(\)/);
  assert.match(context, /specificationCacheRef\.current\.get\(template\.slug\)/);
  assert.match(context, /specificationCacheRef\.current\.set\(template\.slug, specifications\)/);
  assert.match(context, /new AbortController\(\)/);
  assert.match(context, /requestAbortRef\.current\?\.abort\(\)/);
  assert.match(context, /requestSerialRef\.current !== requestSerial/);
  assert.match(context, /activeId: ready \? \(active\?\.id \?\? null\) : null/);
  assert.match(context, /overlay\.style\.opacity = readyRef\.current \? '1' : '0'/);
  assert.match(context, /if \(prefersReducedMotion\) return/);
  assert.equal((context.match(/<TemplateReplayPreview/g) ?? []).length, 1);
  assert.doesNotMatch(context, /console\.|toast\(/);
});
