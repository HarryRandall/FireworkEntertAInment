/** Document edits, gesture boundaries and source visibility exercise immutable behaviour. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { effectTemplates } from '@showcrafter/fireworks';
import { createHistory, studioReducer, renameLayer } from '../lib/studio/document.ts';
import {
  layerAddress,
  selectedLayer,
  studioLayers,
  previewDocument,
} from '../lib/studio/layers.ts';

const document = effectTemplates.find((item) => item.design.kind === 'shell').design;
const layerId = document.breaks[0].layers[0].id;
const renamed = (name) => renameLayer(document, 0, layerId, name);

test('rename targets a break and stable layer ID, leaving the source unchanged', () => {
  const original = structuredClone(document);
  const next = renamed('New star group');
  assert.equal(next.breaks[0].layers[0].name, 'New star group');
  assert.deepEqual(document, original);
  assert.deepEqual(renameLayer(document, 0, 'absent', 'ignored'), original);
});
test('undo and redo restore full snapshots and new edits discard redo', () => {
  let history = studioReducer(createHistory(document), {
    type: 'replace',
    document: renamed('First'),
  });
  history = studioReducer(history, { type: 'undo' });
  assert.deepEqual(history.document, document);
  history = studioReducer(history, { type: 'redo' });
  assert.equal(history.document.breaks[0].layers[0].name, 'First');
  history = studioReducer(history, { type: 'undo' });
  history = studioReducer(history, { type: 'replace', document: renamed('Second') });
  assert.equal(history.redo.length, 0);
});
test('a gesture with many changes commits one undo step, cancellation restores its origin', () => {
  let history = studioReducer(createHistory(document), { type: 'begin' });
  for (const name of ['A', 'AB', 'ABC'])
    history = studioReducer(history, { type: 'replace', document: renamed(name) });
  assert.equal(history.undo.length, 0);
  assert.strictEqual(studioReducer(history, { type: 'undo' }), history);
  const cancelled = studioReducer(history, { type: 'cancel' });
  assert.deepEqual(cancelled.document, document);
  history = studioReducer(history, { type: 'commit' });
  assert.equal(history.undo.length, 1);
  assert.deepEqual(studioReducer(history, { type: 'undo' }).document, document);
});
test('unchanged edits and empty history do not add undo steps', () => {
  const history = createHistory(document);
  assert.equal(
    studioReducer(history, { type: 'replace', document: structuredClone(document) }).undo.length,
    0,
  );
  assert.strictEqual(studioReducer(history, { type: 'undo' }), history);
  assert.strictEqual(studioReducer(history, { type: 'redo' }), history);
});
test('history has a bounded snapshot budget', () => {
  let history = createHistory(document);
  for (let index = 0; index < 110; index++)
    history = studioReducer(history, { type: 'replace', document: renamed(String(index)) });
  assert.equal(history.undo.length, 100);
});
test('repeated layer IDs across breaks retain distinct tree selection', () => {
  const multi = { ...document, breaks: [document.breaks[0], structuredClone(document.breaks[0])] };
  const address = layerAddress(1, layerId);
  assert.deepEqual(selectedLayer(multi, address), { breakIndex: 1, layerId });
  const rows = studioLayers(multi, new Set(['break:0']), new Set([address]));
  assert.equal(
    rows.some((row) => row.id === layerAddress(0, layerId)),
    false,
  );
  assert.equal(rows.find((row) => row.id === address).hidden, true);
  assert.equal(selectedLayer(multi, 'launch'), null);
});
test('preview hides selected layers and complete breaks without mutating stored designs', () => {
  const original = structuredClone(document);
  assert.equal(
    previewDocument(document, new Set([layerAddress(0, layerId)])).breaks[0].layers.length,
    document.breaks[0].layers.length - 1,
  );
  const hiddenBreak = previewDocument(document, new Set(['break:0', 'launch']));
  assert.equal(hiddenBreak.breaks[0].layers.length, 0);
  assert.equal(hiddenBreak.breaks[0].core.enabled, false);
  assert.equal(hiddenBreak.launch.sparks, 0);
  assert.deepEqual(document, original);
});
test('ground kinds have one ground source in the tree', () => {
  const ground = effectTemplates.find((item) => item.design.kind === 'fountain').design;
  assert.deepEqual(
    studioLayers(ground, new Set(), new Set()).map((item) => item.id),
    ['ground'],
  );
});
