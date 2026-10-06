/** Regression guards for firework/effect editor preset switching and one-click save. */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('design editors retain optimistic save, rollback and newer edits', () => {
  for (const editor of [
    read('app/(admin)/admin/fireworks/[id]/_components/FireworkEditor.tsx'),
    read('app/(admin)/admin/effects/[id]/_components/EffectEditor.tsx'),
  ]) {
    assert.match(editor, /beginOptimisticMutation/);
    assert.match(editor, /applySnapshot\(savedSnapshot\)/);
    assert.match(editor, /rollbackOptimisticMutation\(mutation\)/);
    assert.match(editor, /canApplySavedEditorSnapshot/);
    assert.match(editor, /useDesignTabs/);
    assert.match(editor, /design: fields.design/);
    assert.doesNotMatch(editor, /saveCurrentStyleAsDefault/);
  }
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
