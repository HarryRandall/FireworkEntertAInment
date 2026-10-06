import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('both editors share the renderer timeline and disposable built-in player', () => {
  const tabs = read('ui/firework-editor/renderer-design/tabs.tsx');
  const preview = read('ui/firework-editor/renderer-design/preview-surface.tsx');
  assert.match(tabs, /id: 'timeline'/);
  assert.match(tabs, /TimelineInspector/);
  assert.match(preview, /new Viewer/);
  assert.match(preview, /ui: player/);
  assert.match(preview, /instance.dispose\(\)/);
  for (const editor of [
    read('app/(admin)/admin/fireworks/[id]/_components/FireworkEditor.tsx'),
    read('app/(admin)/admin/effects/[id]/_components/EffectEditor.tsx'),
  ])
    assert.match(editor, /useDesignTabs/);
});

test('renderer timeline exposes labelled sliders and numeric inputs for authored lifecycle phases', () => {
  const panel = read('ui/firework-editor/renderer-design/timeline-inspector.tsx');
  const controls = read('ui/firework-editor/renderer-design/inspector-controls.tsx');
  for (const phase of ['time_s', 'delay_s', 'life_s']) assert.match(panel, new RegExp(phase));
  assert.match(panel, /BREAK_CONTROLS.map/);
  assert.match(controls, /aria-label=\{control.label\}/);
  assert.match(controls, /aria-label=\{`\$\{control.label\} value`\}/);
  assert.match(controls, /htmlFor=\{id\}/);
  assert.match(controls, /type="number"/);
  assert.match(controls, /Number.isFinite\(next\)/);
});

test('new timeline authors design seconds without changing legacy scheduling fields', () => {
  const panel = read('ui/firework-editor/renderer-design/timeline-inspector.tsx');
  assert.match(panel, /draft.launch.time_s = value/);
  assert.match(panel, /draft.breaks\[index\]/);
  assert.doesNotMatch(panel, /setDurationSeconds|render_overrides_json|model_json/);
});

test('timeline timing logic edits existing renderer fields without a parallel schema', () => {
  const timing = read('../../packages/fireworks/src/timing.ts');

  assert.match(timing, /export function deriveFireworkEditorTimeline/);
  assert.match(timing, /export function applyFireworkTimelineEdit/);
  assert.match(timing, /export function applyFireworkTimelineBoundaryEdit/);
  assert.match(timing, /defaults\.liftVelocity = solveLiftVelocity/);
  assert.match(timing, /head\.brightnessHoldPercent/);
  assert.match(timing, /lifetime\.percent = roundTimelineSeconds\(multiplier\)/);
  assert.match(timing, /split\.lifeBaseSeconds/);
  assert.match(timing, /smokeDefaults\.lifeSeconds/);
  assert.doesNotMatch(timing, /timelineDurationSeconds|timelinePhases:/);
});
