/** Regression guards for firework/effect editor preset switching and one-click save. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

test('Save new default persists the link and clears overrides in one click', () => {
  const fireworkEditor = read('app/(admin)/admin/fireworks/[id]/FireworkEditor.tsx');
  const effectEditor = read('app/(admin)/admin/effects/[id]/EffectEditor.tsx');

  assert.match(fireworkEditor, /async function persistFirework\(/);
  assert.match(
    fireworkEditor,
    /await persistFirework\(\{[\s\S]*?styleDefaultIdsMap: nextSaveMap,[\s\S]*?overrides: nextMerged,[\s\S]*?\}\)/,
  );
  assert.match(
    fireworkEditor,
    /saveCurrentStyleAsDefault[\s\S]*?removeStyleDefaultOverridesFromRecord\(nextOverridesRecord, kind\)/,
  );
  assert.match(fireworkEditor, /setSavedSignature\(\s*fireworkEditorSignature\(/);
  assert.match(fireworkEditor, /Style default created and saved/);

  assert.match(effectEditor, /async function persistEffect\(/);
  assert.match(
    effectEditor,
    /await persistEffect\(\{[\s\S]*?styleDefaultIdsMap: nextSaveMap,[\s\S]*?modelJson: nextModelText,[\s\S]*?\}\)/,
  );
  assert.match(
    effectEditor,
    /saveCurrentStyleAsDefault[\s\S]*?removeStyleDefaultOverridesFromRecord\(nextRenderDefaults, kind\)/,
  );
  assert.match(effectEditor, /setSavedSignature\(\s*effectEditorSignature\(/);
  assert.match(effectEditor, /Style default created and saved/);
});

test('writing a top-level burstTrail clears nested star layer burstTrails', () => {
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
    /function writeBurstTrail[\s\S]*?if \(!layerKey\) \{[\s\S]*?clearNestedStarBurstTrails\(draft\)/,
  );
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

test('style-default link writes surface errors instead of silently succeeding', () => {
  const assignments = read('lib/admin/style-default-assignments.ts');

  assert.doesNotMatch(
    assignments,
    /isMissingStyleDefaultSchemaError\(deleteResult\.error\)\) return \{ ok: true \}/,
  );
  assert.doesNotMatch(
    assignments,
    /isMissingStyleDefaultSchemaError\(insertResult\.error\)\) return \{ ok: true \}/,
  );
  assert.match(assignments, /return \{ ok: false, error: deleteResult\.error\.message \};/);
  assert.match(assignments, /return \{ ok: false, error: insertResult\.error\.message \};/);
});
