/** Static guards for copy-on-apply firework style defaults. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('style default schema keeps saved defaults and prunes live links', () => {
  const types = read('lib/database.types.ts');
  assert.doesNotMatch(types, /firework_effect_style_default_links: \{/);
  assert.doesNotMatch(types, /firework_style_default_links: \{/);
  assert.doesNotMatch(types, /star_style_default_id:/);
  assert.doesNotMatch(types, /trail_style_default_id:/);
});

test('admin actions save copied default settings without live assignments', () => {
  const effectActions = read('app/(admin)/admin/effects/actions.ts');
  const fireworkActions = read('app/(admin)/admin/fireworks/actions.ts');
  const effectEditor = read('app/(admin)/admin/effects/[id]/_components/EffectEditor.tsx');
  const fireworkEditor = read('app/(admin)/admin/fireworks/[id]/_components/FireworkEditor.tsx');

  assert.match(effectActions, /StyleDefaultAssignmentsSchema/);
  assert.doesNotMatch(effectActions, /normaliseStyleDefaultAssignments/);
  assert.doesNotMatch(effectActions, /replaceEffectStyleDefaultLinks/);
  assert.doesNotMatch(effectActions, /star_style_default_id|trail_style_default_id/);

  assert.match(fireworkActions, /StyleDefaultAssignmentsSchema/);
  assert.doesNotMatch(fireworkActions, /replaceFireworkStyleDefaultLinks/);
  assert.doesNotMatch(fireworkActions, /star_style_default_id|trail_style_default_id/);

  assert.match(effectEditor, /function copySelectedStyleDefaultsIntoModel/);
  assert.match(effectEditor, /applySnapshot\(savedSnapshot\)/);
  assert.match(fireworkEditor, /function copySelectedStyleDefaultsIntoOverrides/);
  assert.match(fireworkEditor, /applySnapshot\(savedSnapshot\)/);
});

test('renderer editors save through the atomic transaction without inline legacy preset actions', () => {
  const effectActions = read('app/(admin)/admin/effects/actions.ts');
  const fireworkActions = read('app/(admin)/admin/fireworks/actions.ts');
  const effectEditor = read('app/(admin)/admin/effects/[id]/_components/EffectEditor.tsx');
  const fireworkEditor = read('app/(admin)/admin/fireworks/[id]/_components/FireworkEditor.tsx');

  assert.doesNotMatch(effectActions, /createStyleDefaultAndUpdateEffect/);
  assert.match(effectActions, /saveEditorRecord/);
  assert.doesNotMatch(fireworkActions, /createStyleDefaultAndUpdateFirework/);
  assert.match(fireworkActions, /saveEditorRecord/);
  assert.match(effectEditor, /useDesignTabs/);
  assert.match(fireworkEditor, /useDesignTabs/);
  assert.doesNotMatch(effectEditor, /await createStyleDefault\(\{/);
  assert.doesNotMatch(fireworkEditor, /await createStyleDefault\(\{/);
});
