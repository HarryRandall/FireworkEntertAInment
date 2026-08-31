/** Focused source guards for fail-closed admin reads. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('RBAC fallback checks every query error before computing effective access', () => {
  const source = read('lib/admin/current-user.server.ts');
  const fallbackStart = source.indexOf('const fallbackErrors =');
  const profileRead = source.indexOf('const profile = profileResult.data;');

  assert.ok(fallbackStart >= 0, 'fallback error collection is present');
  assert.ok(profileRead > fallbackStart, 'fallback errors are checked before profile data is used');

  const failClosedBlock = source.slice(fallbackStart, profileRead);
  for (const result of [
    'profileResult',
    'allRolesResult',
    'userRolesResult',
    'rolePermissionsResult',
    'allPermissionsResult',
    'overridesResult',
  ]) {
    assert.match(failClosedBlock, new RegExp(`${result}\\.error`));
  }

  assert.match(failClosedBlock, /if \(fallbackErrors\.length > 0\)/);
  assert.match(failClosedBlock, /throw new Error\('Current user access could not be loaded\.'/);
});

test('admin generation settings fall back only when the settings row is missing', () => {
  const source = read('lib/admin/prompts.server.ts');

  assert.match(source, /function throwGenerationSettingReadError/);
  assert.match(
    source,
    /if \(generationSettingResult\.error\) \{[\s\S]*?throwGenerationSettingReadError\([\s\S]*?generationSettingResult\.error/,
  );
  assert.match(
    source,
    /generationSetting = generationSettingResult\.data[\s\S]*?mapGenerationSetting[\s\S]*?: fallbackGenerationSetting\(\)/,
  );
  assert.match(
    source,
    /if \(error\) \{\s*throwGenerationSettingReadError\('getAdminShowGenerationSetting', error\);\s*\}/,
  );
  assert.doesNotMatch(source, /if \(error\) \{\s*return fallbackGenerationSetting\(\);\s*\}/);
});

test('admin prompt configuration reads throw instead of returning empty fallbacks', () => {
  const source = read('lib/admin/prompts.server.ts');

  assert.match(source, /function throwPromptConfigReadError/);
  assert.match(
    source,
    /if \(error\) \{\s*throwPromptConfigReadError\('listAdminPromptConfigs', error\);\s*\}/,
  );
  assert.match(
    source,
    /if \(configsResult\.error\) \{[\s\S]*?throwPromptConfigReadError\([\s\S]*?configsResult\.error/,
  );
  assert.doesNotMatch(source, /listAdminPromptConfigs failed:[\s\S]*?return \[\]/);
  assert.doesNotMatch(source, /configs = \[\]/);
});
