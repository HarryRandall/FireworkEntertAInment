import '../../../../scripts/renderer/register-typescript.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const { effectTemplates } = await import('@showcrafter/renderer');
const { createHistory, editorReducer } = await import('../../lib/renderer-editor/document.ts');
const { editDesign, changeLaunchHeight, addBreak, toggleModifier, setTrailEnabled, setAdjustment } =
  await import('../../lib/renderer-editor/inspector.ts');
const { designChanges } = await import('../../lib/renderer-editor/diff.ts');
const { validateEditorDesign } = await import('../../lib/renderer-editor/validation.ts');
const { LAUNCH_CONTROLS } = await import('../../lib/renderer-editor/launch-controls.ts');
const { addCurveKey, moveCurveKey, addGradientStop, moveGradientStop } =
  await import('../../ui/firework-editor/renderer-design/editor-maths.ts');
const peony = effectTemplates.find((item) => item.key === 'peony').design;
test('ported controls preserve height/time coupling, siblings and immutable inputs', () => {
  const before = structuredClone(peony);
  const result = editDesign(peony, (draft) => changeLaunchHeight(draft, peony.launch.height_m * 4));
  assert.equal(result.kind, 'edited');
  assert.equal(result.document.launch.time_s, peony.launch.time_s * 2);
  assert.deepEqual(peony, before);
  assert.deepEqual(result.document.breaks, peony.breaks);
  const invalid = editDesign(peony, (draft) => {
    draft.launch.height_m = -1;
  });
  assert.equal(invalid.kind, 'invalid');
  assert.equal(validateEditorDesign({}).ok, false);
});
test('structural, modifier, trail and relative edits retain independent fields', () => {
  const result = editDesign(peony, (draft) => {
    addBreak(draft);
    toggleModifier(draft.breaks[0].layers[0], 'ghost');
    setTrailEnabled(draft.breaks[0].layers[0], false);
  });
  assert.equal(result.kind, 'edited');
  const layer = result.document.breaks[0].layers[0];
  assert.equal(layer.trail.sparks, 0);
  assert.equal(layer.modifiers[0].kind, 'ghost');
  assert.ok(layer.colour.reignition);
  assert.notEqual(result.document.breaks[1].layers[0].id, layer.id);
  assert.equal(setAdjustment(peony, 'layer.missing.count', 1).kind, 'invalid');
  assert.equal(
    setAdjustment(peony, `layer.${peony.breaks[0].layers[0].id}.count`, 4).kind,
    'invalid',
  );
  for (const control of LAUNCH_CONTROLS) assert.ok(control.min < control.max && control.step > 0);
});
test('gesture history groups drags, cancels, undoes and drops stale redo', () => {
  let state = createHistory(peony);
  state = editorReducer(state, { type: 'begin' });
  state = editorReducer(state, { type: 'replace', document: { ...peony, seed: 123 } });
  state = editorReducer(state, { type: 'replace', document: { ...peony, seed: 456 } });
  state = editorReducer(state, { type: 'commit' });
  assert.equal(state.undo.length, 1);
  state = editorReducer(state, { type: 'undo' });
  assert.deepEqual(state.document, peony);
  state = editorReducer(state, { type: 'redo' });
  assert.equal(state.document.seed, 456);
  state = editorReducer(state, { type: 'begin' });
  state = editorReducer(state, { type: 'replace', document: { ...peony, seed: 789 } });
  state = editorReducer(state, { type: 'cancel' });
  assert.equal(state.document.seed, 456);
  state = editorReducer(state, { type: 'undo' });
  state = editorReducer(state, { type: 'replace', document: { ...peony, seed: 999 } });
  assert.equal(state.redo.length, 0);
});
test('design summaries preserve small changes and gradient/curve maths retain endpoints', () => {
  const next = structuredClone(peony);
  next.breaks[0].layers[0].life_s += 0.001;
  const changes = designChanges(peony, next);
  assert.equal(changes.length, 1);
  assert.match(changes[0].label, /life s/);
  const keys = addCurveKey(
    [
      [0, 1],
      [1, 0],
    ],
    0.5,
    0.8,
  );
  assert.equal(keys.length, 3);
  assert.equal(
    moveCurveKey(keys, 1, [0.6, 0.4], { pinEnds: true, maxTime: 1, maxValue: 2 })[1][0],
    0.6,
  );
  const colour = peony.breaks[0].layers[0].colour;
  const stops = addGradientStop(colour, 0.5);
  assert.equal(stops.length, colour.stops.length + 1);
  assert.equal(moveGradientStop(stops, 0, 0.3, { pinEnds: true, maxTime: 1 })[0][0], 0);
});
test('design-only edits change both editor dirty signatures', async () => {
  const { readFileSync } = await import('node:fs');
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const ts = require('typescript');
  const { runInNewContext } = await import('node:vm');
  for (const [group, name] of [
    ['effects', 'effect'],
    ['fireworks', 'firework'],
  ]) {
    const source = readFileSync(
      new URL(
        `../../app/(admin)/admin/${group}/[id]/_components/${name === 'effect' ? 'Effect' : 'Firework'}Editor.tsx`,
        import.meta.url,
      ),
      'utf8',
    );
    const tree = ts.createSourceFile(
      'editor.tsx',
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const node = tree.statements.find(
      (item) => ts.isFunctionDeclaration(item) && item.name?.text === `${name}EditorSignature`,
    );
    assert.ok(node);
    const output = ts.transpileModule(node.getText(tree), {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const signature = runInNewContext(`${output}; ${name}EditorSignature`);
    const baseline = { design: peony, name: 'Unchanged' };
    const next = { ...baseline, design: { ...peony, seed: 12345 } };
    assert.notEqual(signature(baseline), signature(next));
    assert.equal(JSON.parse(signature(next)).design.seed, 12345);
  }
});

test('shape hover documents resolve the selected layer by id and preserve authored siblings', async () => {
  const { layerChipPreview } =
    await import('../../ui/firework-editor/renderer-design/chip-preview.ts');
  const document = structuredClone(peony);
  const layer = document.breaks[0].layers[0];
  const before = structuredClone(document);
  const preview = layerChipPreview(document, structuredClone(layer), { shape: 'heart' });
  assert.ok(preview);
  assert.equal(preview.breaks[0].layers[0].pattern, 'heart');
  assert.deepEqual(document, before);
  assert.deepEqual(preview.launch, document.launch);
  assert.equal(layerChipPreview(document, { ...layer, id: 'missing' }, { shape: 'heart' }), null);
});
