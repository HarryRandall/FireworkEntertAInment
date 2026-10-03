// Copy/apply behaviour, deterministic variation locks and native editing shortcuts.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  designSchema,
  effectTemplates,
  resolveDesign,
} from '../../../packages/fireworks/src/index.ts';
import { applyLibrary, libraryEntries, partEnvelope } from '../lib/studio/library.ts';

const source = effectTemplates.find((item) => item.key === 'peony').design;
const address = `layer:0:${source.breaks[0].layers[0].id}`;
const choices = libraryEntries();
const entry = (category, option) =>
  choices.find((item) => item.category === category && (!option || item.option === option));

test('parts copy into the selected break with unique IDs and leave the source unchanged', () => {
  const document = structuredClone(source);
  document.breaks.push(structuredClone(document.breaks[0]));
  const before = structuredClone(document);
  const result = applyLibrary(document, 'break:1', entry('stars'));
  assert.equal(result.kind, 'edited');
  assert.deepEqual(document, before);
  assert.equal(result.document.breaks[0].layers.length, before.breaks[0].layers.length);
  assert.equal(result.document.breaks[1].layers.length, before.breaks[1].layers.length + 1);
  const added = result.document.breaks[1].layers.at(-1);
  assert.equal(added.hidden, false);
  assert.equal(added.delay_s, 0);
  assert.ok(!before.breaks.flatMap((burst) => burst.layers).some((layer) => layer.id === added.id));
  assert.ok(designSchema.safeParse(result.document).success);
});

test('trail and effect choices preserve siblings and require a selected group', () => {
  const document = structuredClone(source);
  const sibling = structuredClone(document.breaks[0].layers[0]);
  sibling.id = 'sibling';
  document.breaks[0].layers.push(sibling);
  for (const choice of [entry('trails'), entry('effects', 'crackle')]) {
    const result = applyLibrary(document, address, choice);
    assert.equal(result.kind, 'edited');
    assert.deepEqual(result.document.breaks[0].layers[1], sibling);
    assert.equal(applyLibrary(document, 'launch', choice).kind, 'invalid');
  }
});

test('saved part envelope resolves adjustments and survives independent source changes', () => {
  const document = structuredClone(source);
  document.adjustments = { [`layer.${document.breaks[0].layers[0].id}.stars`]: 1 };
  const envelope = partEnvelope(document, address);
  assert.deepEqual(envelope.breaks[0].layers[0], resolveDesign(document).breaks[0].layers[0]);
  assert.equal(envelope.breaks.length, 1);
  assert.equal(envelope.breaks[0].layers.length, 1);
  document.breaks[0].layers[0].name = 'Changed';
  assert.notEqual(envelope.breaks[0].layers[0].name, 'Changed');
  const saved = { id: 'saved', name: 'Saved trail', category: 'trails', design: envelope };
  assert.equal(applyLibrary(source, address, saved).kind, 'edited');
});
