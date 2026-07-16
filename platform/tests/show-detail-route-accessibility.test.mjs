/** Static guards for stable show-detail headings and navigation focus. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('show detail chrome keeps an accessible heading without visible title chrome', () => {
  const layout = read('app/(app)/shows/[id]/layout.tsx');
  const chrome = read('app/(app)/shows/[id]/ShowDetailChrome.tsx');

  assert.match(layout, /showTitle=\{show\.title\}/);
  assert.match(chrome, /<h1[^>]*className="sr-only"/);
  assert.match(chrome, /\{showTitle\}/);
  assert.doesNotMatch(chrome, /section\.description|aria-describedby=\{descriptionId\}/);

  for (const path of [
    'app/(app)/shows/[id]/preview/page.tsx',
    'app/(app)/shows/[id]/shopping-list/page.tsx',
    'app/(app)/shows/[id]/show-guide/page.tsx',
    'app/(app)/shows/[id]/timeline/page.tsx',
  ]) {
    assert.doesNotMatch(read(path), /<h1\b/, `${path} must not duplicate the shared heading`);
  }
});

test('client navigation moves focus to the updated show heading', () => {
  const chrome = read('app/(app)/shows/[id]/ShowDetailChrome.tsx');
  const tabs = read('app/(app)/shows/[id]/ShowTabs.tsx');

  assert.match(chrome, /const routeKey = `\$\{showSlug\}:\$\{segment \?\? section\.segment\}/);
  assert.match(chrome, /previousRouteKeyRef\.current === routeKey/);
  assert.match(chrome, /headingRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(chrome, /tabIndex=\{-1\}/);
  assert.match(tabs, /aria-current=\{active \? 'page' : undefined\}/);
});

test('preview content follows the shared heading hierarchy', () => {
  const viewer = read('app/components/app/FireworkReplayViewer.tsx');

  assert.match(viewer, /<h2[^>]*>No typed fireworks yet<\/h2>/);
  assert.match(viewer, /<h2[^>]*>Cues<\/h2>/);
  assert.match(viewer, /<h2[^>]*>Adjust this show<\/h2>/);
  assert.doesNotMatch(viewer, /<h3\b/);
});

test('show loading boundaries preserve real route chrome without redrawing it', () => {
  const parentLoading = read('app/(app)/shows/loading.tsx');
  const detailLoading = read('app/(app)/shows/[id]/loading.tsx');

  assert.match(parentLoading, /<h1 className="sr-only">Show details<\/h1>/);
  assert.doesNotMatch(parentLoading, /\{activeSection\.description\}/);
  assert.match(parentLoading, /<ShowTabs id=\{showSlug\} prefetch=\{false\} \/>/);
  assert.match(parentLoading, /<ShowDetailContentSkeleton segment=\{detailMatch\[2\]\} \/>/);
  assert.match(parentLoading, /aria-busy="true"/);
  assert.match(parentLoading, /role="status" aria-live="polite"/);
  assert.match(detailLoading, /<ShowDetailContentSkeleton segment=\{segment\} \/>/);
  assert.doesNotMatch(detailLoading, /<h1|<nav|from '@\/app\/components\/ui\/Feedback'/);
});

test('show loading content matches the active section', () => {
  const skeleton = read('app/(app)/shows/[id]/ShowDetailContentSkeleton.tsx');

  assert.match(skeleton, /case 'shopping-list':[\s\S]*?<ShoppingListSkeleton \/>/);
  assert.match(skeleton, /case 'show-guide':[\s\S]*?<ListSkeleton rows=\{8\} \/>/);
  assert.match(skeleton, /case 'timeline':[\s\S]*?<SongContextSkeleton \/>/);
  assert.match(skeleton, /case 'preview':[\s\S]*?<ReplayPanelSkeleton \/>/);
});

test('generation and not-found routes keep their dedicated headings', () => {
  const chrome = read('app/(app)/shows/[id]/ShowDetailChrome.tsx');
  const notFound = read('app/(app)/shows/[id]/not-found.tsx');
  const generating = read('app/(app)/shows/[id]/generating/page.tsx');

  assert.match(chrome, /forceContentOnly \|\| segment === 'generating'/);
  assert.match(notFound, /<h1/);
  assert.match(generating, /<h1[^>]*>Show generation failed<\/h1>/);
});
