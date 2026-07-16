/** Guards for mutations that must not report success after missing or failed writes. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

function read(path) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

test('cover poster writes require the owned show row to be returned', () => {
  const source = read('app/actions/show-cover-poster.ts');

  assert.match(source, /\.eq\('user_id', user\.id\)\s*\.select\('id'\)\s*\.maybeSingle\(\)/);
  assert.match(source, /if \(error \|\| !updatedShow\)/);
});

test('shopping totals fail closed and derived writes require a returned show', () => {
  const shopping = read('lib/shows/shopping.server.ts');
  const mutations = read('lib/shows/mutations.server.ts');

  assert.match(shopping, /error: inventoryError/);
  assert.match(shopping, /if \(inventoryError\)[\s\S]*return null/);
  assert.match(mutations, /if \(!computed\)[\s\S]*throw new Error/);
  assert.match(mutations, /\.select\('id'\)\s*\.maybeSingle\(\)/);
  assert.match(mutations, /if \(error \|\| !updatedShow\)/);
  assert.ok(
    mutations.indexOf('if (error || !updatedShow)') <
      mutations.indexOf('await invalidateShowCacheForUser'),
  );
});

test('generation, cloning, and cue edits cannot present failed total syncs as success', () => {
  const runner = read('lib/cue-generation/runner.server.ts');
  const templates = read('app/actions/show-templates.ts');
  const preview = read('app/actions/preview-cues.ts');

  const syncIndex = runner.indexOf('await syncShowDerivedFieldsForUser');
  const completeIndex = runner.indexOf("generation_status: 'completed'", syncIndex);
  assert.ok(syncIndex >= 0 && completeIndex > syncIndex);
  assert.match(runner, /derived-field sync failed:[\s\S]*generation_status: 'failed'/);
  assert.match(templates, /derived-field sync failed:[\s\S]*cleanupSucceeded: removed/);
  assert.match(preview, /The cue was added, but show totals could not refresh/);
  assert.match(preview, /The cue was removed, but show totals could not refresh/);
});
