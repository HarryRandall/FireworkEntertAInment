/** Guards against reporting success when an update matched no database row. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('catalogue metadata updates require the canonical updated row', () => {
  const action = read('app/actions/admin-catalogue.ts');

  assert.match(
    action,
    /const \{ data: updatedProduct, error \} = await supabase[\s\S]*?\.update\([\s\S]*?\.eq\('id', parsed\.data\.id\)[\s\S]*?\.select\('id'\)[\s\S]*?\.maybeSingle\(\)/,
  );
  assert.match(
    action,
    /if \(!updatedProduct\) return \{ ok: false, error: 'Catalogue item not found\.' \}/,
  );
  assert.match(action, /if \(!updatedProduct\)[\s\S]*?invalidateAdminCatalogueCache\(\)/);
});

test('every show preset update rejects a missing returned row before success', () => {
  const actions = read('app/actions/admin-show-presets.ts');

  assert.match(
    actions,
    /const \{ data: updatedPreset, error \} = await supabase[\s\S]*?\.select\('slug'\)[\s\S]*?\.maybeSingle\(\)[\s\S]*?if \(!updatedPreset\) return \{ ok: false, error: 'Preset not found\.' \}/,
  );
  assert.match(
    actions,
    /const \{ data: preset, error \} = await supabase[\s\S]*?preview_cues:[\s\S]*?\.select\('slug'\)[\s\S]*?\.maybeSingle\(\)[\s\S]*?if \(!preset\) return \{ ok: false, error: 'Preset not found\.' \}/,
  );
  assert.match(
    actions,
    /const \{ data, error \} = await supabase[\s\S]*?\.update\(publicationPatch\)[\s\S]*?\.select\('slug'\)[\s\S]*?\.maybeSingle\(\)[\s\S]*?if \(!data\) return \{ ok: false, error: 'Preset not found\.' \}/,
  );
  assert.ok(
    (actions.match(/return \{ ok: false, error: 'Preset not found\.' \}/g) ?? []).length >= 3,
  );
});
