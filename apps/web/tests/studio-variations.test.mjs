// Seeded variations and locked candidate history.
import assert from 'node:assert/strict';
import test from 'node:test';
import { effectTemplates } from '../../../packages/fireworks/src/index.ts';
const source = effectTemplates.find((item) => item.key === 'peony').design;
import { designSchema } from '../../../packages/fireworks/src/index.ts';
import { applyLibrary, libraryEntries } from '../lib/studio/library.ts';
import { createHistory, studioReducer } from '../lib/studio/document.ts';
import { rollVariations, varyDesign } from '../lib/studio/variations.ts';
const address = `layer:0:${source.breaks[0].layers[0].id}`;
const choices = libraryEntries();
const entry = (category) => choices.find((item) => item.category === category);
test('whole replacements and variation applies are exactly one undo step', () => {
  const replacement = applyLibrary(source, address, entry('fireworks'));
  assert.equal(replacement.kind, 'edited');
  const variant = varyDesign(source, 123);
  const state = studioReducer(createHistory(source), { type: 'replace', document: variant });
  assert.equal(state.undo.length, 1);
  assert.deepEqual(studioReducer(state, { type: 'undo' }).document, source);
  assert.deepEqual(
    studioReducer(studioReducer(state, { type: 'undo' }), { type: 'redo' }).document,
    variant,
  );
});

test('all template variations are deterministic valid documents and locked snapshots retain identity', () => {
  for (const template of effectTemplates) {
    assert.deepEqual(varyDesign(template.design, 83), varyDesign(template.design, 83));
    assert.ok(designSchema.safeParse(varyDesign(template.design, 83)).success);
  }
  const previous = rollVariations(source, [], new Set(), 12);
  const rerolled = rollVariations(source, previous, new Set([0, 3]), 51);
  assert.equal(rerolled[0], previous[0]);
  assert.equal(rerolled[3], previous[3]);
  assert.notDeepEqual(rerolled[1], previous[1]);
  assert.equal(rerolled.length, 6);
});
