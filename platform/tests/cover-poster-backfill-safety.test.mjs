/** Focused guards for cover-poster backfill resource and status safety. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('all poster renders share one synchronous hidden-renderer lock', () => {
  const source = read('app/(admin)/admin/show-presets/CoverPosterBackfill.tsx');

  assert.match(source, /const renderLockRef = useRef\(false\)/);
  assert.match(source, /if \(!preset\.cover \|\| renderLockRef\.current\) return;/);
  assert.match(
    source,
    /renderLockRef\.current = true;[\s\S]*?await renderCoverToPng\(preset\.cover\)/,
  );
  assert.match(source, /finally \{\s+renderLockRef\.current = false;[\s\S]*?setActiveRenderId/);
  assert.match(source, /for \(const preset of missing\) \{[\s\S]*?await renderOne\(preset\)/);
  assert.match(source, /disabled=\{isBusy \|\| missingCount === 0\}/);
  assert.match(source, /disabled=\{isBusy \|\| !preset\.cover\}/);
  assert.doesNotMatch(source, /Promise\.all\(/);
});

test('poster loading and pending states stay bounded and accessible', () => {
  const source = read('app/(admin)/admin/show-presets/CoverPosterBackfill.tsx');

  assert.match(source, /const EAGER_POSTER_COUNT = 6/);
  assert.match(source, /eager=\{index < EAGER_POSTER_COUNT\}/);
  assert.doesNotMatch(source, /\n\s+eager\s*\n/);
  assert.match(source, /role="status"/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /aria-busy=\{isRendering\}/);
  assert.match(source, /loading=\{bulkRunning\}/);
  assert.match(source, /loading=\{isRendering\}/);
  assert.match(source, /Rendering posters…/);
  assert.match(source, /<Badge tone="danger" solid>[\s\S]*?Failed/);
  assert.match(source, /role="alert"/);
});

test('done status follows a bounded canonical database confirmation', () => {
  const action = read('app/actions/admin-cover-posters.ts');

  assert.match(
    action,
    /update\(\{ cover_image_path: path \}\)[\s\S]*?\.select\('cover_image_path'\)[\s\S]*?\.maybeSingle\(\)/,
  );
  assert.match(action, /if \(!updatedPreset\?\.cover_image_path\)/);
  assert.match(action, /return \{ ok: true, path: updatedPreset\.cover_image_path \}/);
});
