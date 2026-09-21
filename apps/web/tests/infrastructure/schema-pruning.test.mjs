/** Static guards for pruning legacy schema objects that the current app no longer uses. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('legacy shopping and supplier-location tables are removed from the schema', () => {
  const types = read('lib/database.types.ts');

  assert.doesNotMatch(types, /shopping_list_items:/);
  assert.doesNotMatch(types, /supplier_locations:/);
  assert.doesNotMatch(types, /location_id:/);
});

test('unused user billing and legacy show-analysis columns stay pruned', () => {
  const types = read('lib/database.types.ts');

  for (const column of [
    'last_seen_at',
    'is_billable',
    'analysis_storage_path',
    'markdown_storage_path',
    'compact_payload',
    'source_audio_path',
    'personality_preset',
  ]) {
    assert.doesNotMatch(types, new RegExp(`${column}:`));
  }
});
