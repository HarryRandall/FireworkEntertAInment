/** Static guards for intent-loaded Explore preview specifications. */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('public Explore lists select and serialise cue-free summaries', () => {
  const libraryPage = read('app/(browse)/library/page.tsx');
  const homePage = read('app/(app)/home/page.tsx');
  const templateReads = read('lib/admin/templates.server.ts');
  const summaryType = read('lib/show-template-summary.ts');
  const cacheKeys = read('lib/admin/cache-keys.ts');

  const summaryColumns = templateReads.match(
    /const SHOW_TEMPLATE_SUMMARIES_CORE_SELECT =\s*'([^']+)'/,
  )?.[1];
  assert.ok(summaryColumns);
  assert.doesNotMatch(summaryColumns, /preview_cues/);
  assert.match(summaryColumns, /composition_signature/);
  assert.match(templateReads, /\.select\(PUBLIC_SHOW_TEMPLATE_SUMMARIES_SELECT\)/);
  assert.match(templateReads, /\.map\(mapShowTemplateSummary\)/);
  assert.match(summaryType, /Omit<ShowTemplate, 'previewCues'>/);
  assert.match(cacheKeys, /show-templates:database-v4/);

  assert.doesNotMatch(libraryPage, /listFireworkProducts/);
  assert.doesNotMatch(libraryPage, /previewCues/);
  assert.match(libraryPage, /const templates = await listShowTemplates\(\)/);
  assert.match(libraryPage, /<ExplorePreviewProvider>/);
  assert.doesNotMatch(homePage, /listFireworkProducts/);
  assert.doesNotMatch(libraryPage, /ExplorePreviewProvider specifications=/);
  assert.doesNotMatch(homePage, /ExplorePreviewProvider specifications=/);
});

test('the scoped preview route returns cues and only their resolved specifications', () => {
  const routePath = 'app/api/library/[slug]/preview/route.ts';
  assert.equal(existsSync(join(root, routePath)), true);

  const route = read(routePath);
  assert.match(route, /getShowTemplateBySlug\(slug\)/);
  assert.match(route, /if \(!template\?\.isPublished\)/);
  assert.match(route, /listReferencedShowTemplateSpecifications\(template\.previewCues\)/);
  assert.doesNotMatch(route, /listFireworkProducts/);
  assert.match(
    route,
    /return response\(\{ previewCues: template\.previewCues, specifications \}\)/,
  );
  assert.match(route, /'Cache-Control': 'no-store, max-age=0'/);
  assert.doesNotMatch(route, /return response\(\{ template/);
});

test('the cue-bearing template read bypasses the summary cache and fails closed', () => {
  const templateReads = read('lib/admin/templates.server.ts');
  const start = templateReads.indexOf('export async function getShowTemplateBySlug');
  assert.notEqual(start, -1);
  const detailRead = templateReads.slice(start);

  assert.doesNotMatch(detailRead, /listShowTemplates\(\)/);
  assert.match(detailRead, /\.select\(PUBLIC_SHOW_TEMPLATES_SELECT\)/);
  assert.match(detailRead, /\.eq\('is_published', true\)/);
  assert.match(detailRead, /throw new Error\('This Explore show could not be loaded\.'\)/);
});

test('the shared specification loader resolves legacy cues and fails closed', () => {
  const helper = read('lib/show-template-specifications.server.ts');

  assert.match(helper, /listFireworkProducts\(\)/);
  assert.match(helper, /cue\.catalogueItemId/);
  assert.match(helper, /cue\.catalogueItemSlug/);
  assert.match(helper, /cue\.fireworkSlug/);
  assert.match(helper, /specification\.variant\?\.slug/);
  assert.match(helper, /specification\.baseEffect\?\.slug/);
  assert.match(helper, /if \(!specification\)/);
  assert.match(helper, /Published Explore show contains an unresolved preview cue/);
  assert.match(helper, /referencedIds\.has\(specification\.id\)/);
});

test('the template detail serialises only cue-referenced specifications', () => {
  const detailPage = read('app/(browse)/library/[id]/page.tsx');

  assert.doesNotMatch(detailPage, /listFireworkProducts/);
  assert.match(detailPage, /listReferencedShowTemplateSpecifications\(template\.previewCues\)/);
  assert.match(
    detailPage,
    /<LibraryDetailReplay template=\{template\} specificationsPromise=\{specificationsPromise\}/,
  );
  assert.match(
    detailPage,
    /<LibraryDetailCurrentFirework[\s\S]*?specificationsPromise=\{specificationsPromise\}/,
  );
});

test('the shared preview loads after intent, caches by slug and stale-guards cancellation', () => {
  const context = read('app/components/app/ExplorePreviewContext.tsx');
  const loader = read('lib/explore-preview.ts');
  const featured = read('app/components/app/HomeDiscoverySections.tsx');

  assert.match(context, /setTimeout\(\(\) => \{[\s\S]*?confirmPreview\(/);
  assert.match(loader, /`\/api\/library\/\$\{encodeURIComponent\(slug\)\}\/preview`/);
  assert.match(loader, /Array\.isArray\([\s\S]*?previewCues/);
  assert.match(loader, /Array\.isArray\([\s\S]*?specifications/);
  assert.match(context, /new Map<string, ExplorePreviewPayload>\(\)/);
  assert.match(context, /const previewKey = `\$\{template\.slug\}:\$\{template\.updatedAt\}`/);
  assert.match(context, /previewCacheRef\.current\.get\(previewKey\)/);
  assert.match(context, /previewCacheRef\.current\.set\(previewKey, preview\)/);
  assert.match(context, /template: \{ \.\.\.template, previewCues: preview\.previewCues \}/);
  assert.match(context, /new AbortController\(\)/);
  assert.match(context, /requestAbortRef\.current\?\.abort\(\)/);
  assert.match(context, /requestSerialRef\.current !== requestSerial/);
  assert.match(context, /readyRef\.current = false;\s+setReady\(false\);\s+setMountedPreview\(/);
  assert.doesNotMatch(
    context,
    /useEffect\(\(\) => \{\s+readyRef\.current = false;\s+setReady\(false\);\s+\}, \[active\?\.id/,
  );
  assert.match(context, /activeId: active\?\.id \?\? null/);
  assert.match(context, /pendingId: pending\?\.id \?\? null/);
  assert.match(context, /overlay\.style\.opacity = readyRef\.current \? '1' : '0'/);
  assert.match(context, /if \(prefersReducedMotion\) return/);
  assert.equal((context.match(/<TemplateReplayPreview/g) ?? []).length, 1);
  assert.doesNotMatch(context, /console\.|toast\(/);

  assert.match(featured, /setTimeout\(\(\) => \{[\s\S]*?loadExplorePreview\(template\.slug/);
  assert.match(featured, /if \(prefersReducedMotion\) return;/);
  assert.match(featured, /replayTemplate && preview && !prefersReducedMotion/);
  assert.match(featured, /setIsPreviewHovered\(false\)/);
  assert.match(featured, /template\.id, template\.slug, template\.updatedAt/);
  assert.match(featured, /motion-reduce:transform-none/);
  assert.match(featured, /motion-reduce:transition-none/);
  assert.match(featured, /\{ \.\.\.template, previewCues: preview\.previewCues \}/);
  assert.match(featured, /\{template\.effectsCount\}/);
  assert.doesNotMatch(featured, /listFireworkProducts/);
  assert.doesNotMatch(featured, /console\.|toast\(/);
});

test('Explore shelves preserve composition de-duplication without serialising cues', () => {
  const libraryPage = read('app/(browse)/library/page.tsx');
  const migration = read(
    'supabase/migrations/20260715081010_add_show_preset_composition_signature.sql',
  );

  assert.match(libraryPage, /usedCompositionSignatures/);
  assert.match(libraryPage, /template\.compositionSignature/);
  assert.doesNotMatch(libraryPage, /previewCues/);
  assert.match(migration, /generated always as/);
  assert.match(migration, /show_preset_composition_signature\(preview_cues\)/);
  assert.match(migration, /grant select \(composition_signature\).*anon, authenticated/s);
});
