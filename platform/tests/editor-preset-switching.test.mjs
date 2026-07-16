/** Regression guards for firework/effect editor preset switching and one-click save. */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('selecting a named style default clears that kind inline overrides', () => {
  const fireworkEditor = read('app/(admin)/admin/fireworks/[id]/FireworkEditor.tsx');
  const effectEditor = read('app/(admin)/admin/effects/[id]/EffectEditor.tsx');

  for (const source of [fireworkEditor, effectEditor]) {
    assert.match(
      source,
      /function handleStyleDefaultChange\(kind: FireworkStyleDefaultKind, value: string\)/,
    );
    assert.match(
      source,
      /if \(value !== NO_STYLE_DEFAULT_VALUE\) \{[\s\S]*?removeStyleDefaultOverridesFromRecord\(/,
    );
    assert.match(source, /onChange=\{\(value\) => handleStyleDefaultChange\(kind, value\)\}/);
  }
});

test('Save new default copies settings and clears transient selection in one click', () => {
  const fireworkEditor = read('app/(admin)/admin/fireworks/[id]/FireworkEditor.tsx');
  const effectEditor = read('app/(admin)/admin/effects/[id]/EffectEditor.tsx');

  assert.match(fireworkEditor, /async function persistFirework\(/);
  assert.match(fireworkEditor, /function copySelectedStyleDefaultsIntoOverrides/);
  assert.match(
    fireworkEditor,
    /await persistFirework\(\{[\s\S]*?styleDefaultIdsMap: clearedSaveMap,[\s\S]*?overrides: copiedOverrides,[\s\S]*?\}\)/,
  );
  assert.match(
    fireworkEditor,
    /saveCurrentStyleAsDefault[\s\S]*?copySelectedStyleDefaultsIntoOverrides\(mergedOverrides\)/,
  );
  assert.match(
    fireworkEditor,
    /saveCurrentStyleAsDefault[\s\S]*?renderOverridesJson: JSON\.stringify\(nextMerged/,
  );
  assert.match(fireworkEditor, /fireworkSavedSnapshotFromFields\(\{/);
  assert.match(
    fireworkEditor,
    /saveCurrentStyleAsDefault[\s\S]*?const mutation = beginOptimisticMutation\(optimisticSnapshot, 'update'\)/,
  );
  assert.match(
    fireworkEditor,
    /createStyleDefaultAndUpdateFirework\(\{[\s\S]*?historyVersionId: mutation\.historyVersionId/,
  );
  assert.match(fireworkEditor, /applySnapshot\(savedSnapshot\)/);
  assert.match(fireworkEditor, /rollbackOptimisticMutation\(mutation\)/);
  assert.match(fireworkEditor, /canApplySavedEditorSnapshot/);
  assert.match(fireworkEditor, /Style default created and saved/);

  assert.match(effectEditor, /async function persistEffect\(/);
  assert.match(effectEditor, /function copySelectedStyleDefaultsIntoModel/);
  assert.match(
    effectEditor,
    /await persistEffect\(\{[\s\S]*?styleDefaultIdsMap: clearedSaveMap,[\s\S]*?modelJson: savedModelText,[\s\S]*?\}\)/,
  );
  assert.match(
    effectEditor,
    /saveCurrentStyleAsDefault[\s\S]*?copySelectedStyleDefaultsIntoModel\(parsedModel\.value\)/,
  );
  assert.match(effectEditor, /effectSavedSnapshotFromFields\(\{/);
  assert.match(
    effectEditor,
    /saveCurrentStyleAsDefault[\s\S]*?const mutation = beginOptimisticMutation\(optimisticSnapshot, 'update'\)/,
  );
  assert.match(
    effectEditor,
    /createStyleDefaultAndUpdateEffect\(\{[\s\S]*?historyVersionId: mutation\.historyVersionId/,
  );
  assert.match(effectEditor, /applySnapshot\(savedSnapshot\)/);
  assert.match(effectEditor, /rollbackOptimisticMutation\(mutation\)/);
  assert.match(effectEditor, /canApplySavedEditorSnapshot/);
  assert.match(effectEditor, /Style default created and saved/);
  assert.doesNotMatch(fireworkEditor, /await createStyleDefault\(\{/);
  assert.doesNotMatch(effectEditor, /await createStyleDefault\(\{/);
});

test('writing a top-level burstTrail clears only the inherited outer layer trail', () => {
  const styleDefaults = read('lib/fireworks/style-defaults.ts');
  const fireworkEditor = read('app/(admin)/admin/fireworks/[id]/FireworkEditor.tsx');
  const effectEditor = read('app/(admin)/admin/effects/[id]/EffectEditor.tsx');
  const controls = read('app/components/admin/FireworkRenderControls.tsx');

  assert.match(
    styleDefaults,
    /export function clearNestedStarBurstTrails\(defaults: JsonRecord\): void/,
  );
  assert.match(styleDefaults, /delete layer\.burstTrail/);

  assert.match(fireworkEditor, /mutateOverridesForStyle\('trail'/);
  assert.match(effectEditor, /updateModelDefaultsForStyle\('trail'/);

  assert.match(
    controls,
    /function writeBurstTrail[\s\S]*?if \(!layerKey\) \{[\s\S]*?delete stars\.outer\.burstTrail/,
  );
  assert.doesNotMatch(controls, /delete stars\.core\.burstTrail/);
  assert.doesNotMatch(controls, /clearNestedStarBurstTrails\(draft\)/);
});

test('changing the base effect resets style defaults and clears overrides', () => {
  const fireworkEditor = read('app/(admin)/admin/fireworks/[id]/FireworkEditor.tsx');

  assert.match(fireworkEditor, /function handleEffectIdChange\(nextEffectId: string\)/);
  assert.match(
    fireworkEditor,
    /handleEffectIdChange[\s\S]*?setStyleDefaultIds\(emptyStyleDefaultIdMap\(\)\)/,
  );
  assert.match(
    fireworkEditor,
    /handleEffectIdChange[\s\S]*?setOverridesText\(JSON\.stringify\(\{\}, null, 2\)\)/,
  );
  assert.match(fireworkEditor, /onChange=\{handleEffectIdChange\}/);
});

test('style defaults are copied through editor JSON instead of live assignment writes', () => {
  const effectActions = read('app/actions/admin-effects.ts');
  const fireworkActions = read('app/actions/admin-fireworks.ts');

  assert.equal(existsSync(join(root, 'lib/admin/style-default-assignments.ts')), false);
  assert.doesNotMatch(effectActions, /style-default-assignments|replaceEffectStyleDefaultLinks/);
  assert.doesNotMatch(
    fireworkActions,
    /style-default-assignments|replaceFireworkStyleDefaultLinks/,
  );
});
