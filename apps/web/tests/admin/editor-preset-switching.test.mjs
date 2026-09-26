/** Regression guards for firework/effect editor preset switching and one-click save. */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('Save new default copies settings and clears transient selection in one click', () => {
  const fireworkEditor = read('app/(admin)/admin/fireworks/[id]/_components/FireworkEditor.tsx');
  const effectEditor = read('app/(admin)/admin/effects/[id]/_components/EffectEditor.tsx');

  assert.match(fireworkEditor, /async function persistFirework\(/);
  assert.match(fireworkEditor, /function copySelectedStyleDefaultsIntoOverrides/);
  assert.match(
    fireworkEditor,
    /await persistFirework\(\{[\s\S]*?styleDefaultIdsMap: clearedSaveMap,[\s\S]*?overrides: copiedOverrides,[\s\S]*?\}\)/,
  );
  assert.match(
    fireworkEditor,
    /saveCurrentStyleAsDefault[\s\S]*?copySelectedStyleDefaultsIntoOverrides\(overridesRecord\)/,
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

test('style defaults are copied through editor JSON instead of live assignment writes', () => {
  const effectActions = read('app/(admin)/admin/effects/actions.ts');
  const fireworkActions = read('app/(admin)/admin/fireworks/actions.ts');

  assert.equal(existsSync(join(root, 'lib/admin/style-default-assignments.ts')), false);
  assert.doesNotMatch(effectActions, /style-default-assignments|replaceEffectStyleDefaultLinks/);
  assert.doesNotMatch(
    fireworkActions,
    /style-default-assignments|replaceFireworkStyleDefaultLinks/,
  );
});
