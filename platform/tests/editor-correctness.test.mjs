import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { canApplySavedEditorSnapshot } from '../lib/admin/editor-save-state.ts';
import { nonNegativeRangeFromMidpoint } from '../lib/fireworks/editor-ranges.ts';
import {
  replayCuesSimulationKey,
  replaySimulationCacheKey,
} from '../lib/fireworks/replay-cache-key.ts';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function makeCue() {
  return {
    id: 'cue-1',
    position: 1,
    timeSeconds: 1.25,
    productId: 'catalogue-1',
    seedOverride: 42,
    launchPositionIndex: 1,
    emphasis: 'normal',
    shotPanDegrees: 4,
    shotTiltDegrees: -3,
    shotPositionOverride: { x: 10, y: 20, z: 30 },
    firework: {
      id: 'firework-1',
      caliber: '30mm',
      durationSeconds: 4.2,
      renderDesign: { size: 60, burst: { speed: [2, 4] } },
      rawSpec: null,
    },
  };
}

test('replay simulation signatures change for every cue input used by the engine', () => {
  const baseCue = makeCue();
  const baseKey = replayCuesSimulationKey([baseCue]);
  const mutations = [
    (cue) => (cue.id = 'cue-2'),
    (cue) => (cue.position = 2),
    (cue) => (cue.timeSeconds = 1.5),
    (cue) => (cue.productId = 'catalogue-2'),
    (cue) => (cue.firework.id = 'firework-2'),
    (cue) => (cue.launchPositionIndex = 2),
    (cue) => (cue.seedOverride = 43),
    (cue) => (cue.emphasis = 'peak'),
    (cue) => (cue.shotPanDegrees = 5),
    (cue) => (cue.shotTiltDegrees = -4),
    (cue) => (cue.shotPositionOverride.x = 11),
    (cue) => (cue.shotPositionOverride.y = 21),
    (cue) => (cue.shotPositionOverride.z = 31),
    (cue) => (cue.firework.caliber = '50mm'),
    (cue) => (cue.firework.durationSeconds = 5),
    (cue) => (cue.firework.renderDesign.size = 61),
  ];

  for (const mutate of mutations) {
    const changedCue = structuredClone(baseCue);
    mutate(changedCue);
    assert.notEqual(replayCuesSimulationKey([changedCue]), baseKey);
  }

  assert.equal(replayCuesSimulationKey([structuredClone(baseCue)]), baseKey);
});

test('snapshot cache signatures include every launch-position coordinate', () => {
  const cue = makeCue();
  const positions = [
    { x: -100, y: 0, z: 20 },
    { x: 100, y: 0, z: 20 },
  ];
  const baseKey = replaySimulationCacheKey([cue], positions);

  for (const axis of ['x', 'y', 'z']) {
    const changedPositions = structuredClone(positions);
    changedPositions[1][axis] += 1;
    assert.notEqual(replaySimulationCacheKey([cue], changedPositions), baseKey);
  }
});

test('editor ranges never emit negative speed or life endpoints', () => {
  assert.deepEqual(nonNegativeRangeFromMidpoint(0.5, 0.6), [0, 1.1]);
  assert.deepEqual(nonNegativeRangeFromMidpoint(4.8, 0.6), [4.2, 5.4]);
  assert.deepEqual(nonNegativeRangeFromMidpoint(-2, -1), [0, 0]);
});

test('save completion only replaces the local snapshot when no newer edit exists', () => {
  assert.equal(canApplySavedEditorSnapshot('same', 'same'), true);
  assert.equal(canApplySavedEditorSnapshot('request', 'newer-edit'), false);
});

test('editor integration keeps history secondary and removes false preview controls', () => {
  const effectActions = read('app/actions/admin-effects.ts');
  const fireworkActions = read('app/actions/admin-fireworks.ts');
  const effectEditor = read('app/(admin)/admin/effects/[id]/EffectEditor.tsx');
  const fireworkEditor = read('app/(admin)/admin/fireworks/[id]/FireworkEditor.tsx');
  const styleDefaultEditor = read('app/(admin)/admin/effects/defaults/[id]/StyleDefaultEditor.tsx');
  const historyPanel = read('app/components/admin/EditorInspectorPanels.tsx');
  const sliderField = read('app/components/ui/SliderField.tsx');

  for (const actions of [effectActions, fireworkActions]) {
    assert.match(actions, /history insert failed/);
    assert.doesNotMatch(actions, /if \(version(?:Result|Error)\) return version(?:Result|Error)/);
  }
  for (const editor of [effectEditor, fireworkEditor, styleDefaultEditor]) {
    assert.match(editor, /canApplySavedEditorSnapshot/);
    assert.match(editor, /newer edits remain unsaved/);
  }
  assert.doesNotMatch(historyPanel, />\s*Preview\s*</);
  assert.doesNotMatch(historyPanel, /onPreview|selectedVersionId/);
  assert.match(sliderField, /SliderPrimitive\.Thumb/);
  assert.match(sliderField, /aria-labelledby=\{labelId\}/);
});
