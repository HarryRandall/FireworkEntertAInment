import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('firework and effect editors share the master timeline panel', () => {
  const fireworkEditor = read('app/(admin)/admin/fireworks/[id]/FireworkEditor.tsx');
  const effectEditor = read('app/(admin)/admin/effects/[id]/EffectEditor.tsx');

  for (const editor of [fireworkEditor, effectEditor]) {
    assert.match(editor, /id: 'timeline'/);
    assert.match(editor, /<FireworkTimelineControls/);
    assert.doesNotMatch(editor, /A master timeline[\s\S]*will live here|title="Coming soon"/);
  }

  assert.match(fireworkEditor, /onMutate=\{mutateOverridesForTimeline\}/);
  assert.match(effectEditor, /onMutate=\{updateModelDefaultsForTimeline\}/);
  assert.match(effectEditor, /durationLabel="Render duration"/);
});

test('timeline panel exposes an accessible total and slider for every lifecycle phase', () => {
  const panel = read('app/components/admin/FireworkTimelineControls.tsx');

  assert.match(panel, /label=\{durationLabel\}/);
  for (const phase of ['ascent', 'burn', 'fade', 'tail']) {
    assert.match(panel, new RegExp(`key: '${phase}'`));
  }
  assert.match(panel, /inputAriaLabel=\{`\$\{phase\.label\} duration value`\}/);
  assert.match(panel, /role="img"/);
  assert.match(panel, /SliderPrimitive\.Thumb/);
  assert.match(panel, /applyFireworkTimelineBoundaryEdit/);
  assert.match(panel, /aria-label=\{`\$\{phase\.label\} end`\}/);
  assert.match(panel, /font-mono/);
  assert.match(panel, /bg-primary/);
  assert.match(panel, /Ground emitters start at the tube/);
  assert.match(panel, /Crackle adds up to/);
});

test('timeline mutations materialise all affected presets in one parent update', () => {
  const fireworkEditor = read('app/(admin)/admin/fireworks/[id]/FireworkEditor.tsx');
  const effectEditor = read('app/(admin)/admin/effects/[id]/EffectEditor.tsx');

  assert.match(
    fireworkEditor,
    /function mutateOverridesForTimeline\([\s\S]*const draft = cloneRecord\(parsedOverrides\.value\)[\s\S]*kinds\.filter\(\(kind\) => materialiseStyleDefault\(kind, draft\)\)[\s\S]*updater\(draft\)[\s\S]*setOverridesText/,
  );
  assert.match(
    effectEditor,
    /function updateModelDefaultsForTimeline\([\s\S]*const draft = cloneRecord\(canonicaliseEffectModelJson\(parsedModel\.value\)\)[\s\S]*const defaults = ensureRecord\(draft, 'renderDefaults'\)[\s\S]*kinds\.filter\(\(kind\) => materialiseStyleDefault\(kind, defaults\)\)[\s\S]*updater\(defaults\)[\s\S]*setModelText/,
  );
  for (const editor of [fireworkEditor, effectEditor]) {
    assert.match(editor, /for \(const kind of customKinds\) next\[kind\] = NO_STYLE_DEFAULT_VALUE/);
  }
});

test('firework timeline changes synchronise scheduling duration to the achieved render end', () => {
  const fireworkEditor = read('app/(admin)/admin/fireworks/[id]/FireworkEditor.tsx');

  assert.match(fireworkEditor, /timelineDurationSyncPendingRef\.current = true/);
  assert.match(
    fireworkEditor,
    /if \(!timelineDurationSyncPendingRef\.current\) return;[\s\S]*setDurationSeconds\(String\(roundTimelineSeconds\(estimateDesignDurationSeconds\(previewDesign\)\)\)\)/,
  );
});

test('timeline timing logic edits existing renderer fields without a parallel schema', () => {
  const timing = read('lib/fireworks/timing.ts');

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
