/** Static guards for the compact multishot editor metadata strip. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('solid badges avoid ambiguous accent foreground pairings', () => {
  const badge = read('app/components/ui/Badge.tsx');

  assert.doesNotMatch(badge, /bg-accent\s+text-accent-foreground/);
  assert.match(badge, /var\(--color-accent\)_14%,transparent/);
  assert.match(badge, /var\(--color-content-emphasis\)/);
});

test('shared UI primitives do not mix semantic accent backgrounds with shadcn foregrounds', () => {
  for (const path of [
    'app/components/ui/Badge.tsx',
    'app/components/ui/Button.tsx',
    'app/components/ui/styles.ts',
  ]) {
    const source = read(path);
    assert.doesNotMatch(source, /bg-accent\s+text-accent-foreground/, path);
  }
});

test('multishot metadata keeps summary badges beside the title', () => {
  const editor = read('app/(admin)/admin/multishots/[id]/MultishotEditor.tsx');
  const metaBar = editor.slice(editor.indexOf('function MetaBar('));
  const titleIndex = metaBar.indexOf('{name ||');
  const durationBadgeIndex = metaBar.indexOf('{durationLabel}');
  const shotBadgeIndex = metaBar.indexOf('{shotCount}');
  const descriptionIndex = metaBar.indexOf('{description ?');
  const editButtonIndex = metaBar.indexOf('Edit details');

  assert.ok(titleIndex > -1);
  assert.ok(durationBadgeIndex > titleIndex);
  assert.ok(shotBadgeIndex > durationBadgeIndex);
  assert.ok(descriptionIndex > shotBadgeIndex);
  assert.ok(editButtonIndex > descriptionIndex);
});

test('multishot inspector keeps controls inside the card and supports deselection', () => {
  const editor = read('app/(admin)/admin/multishots/[id]/MultishotEditor.tsx');
  const inspector = editor.slice(editor.indexOf('function Inspector('));

  assert.doesNotMatch(inspector, /Shot inspector/);
  assert.match(inspector, /No shot selected/);
  assert.doesNotMatch(inspector, /Select a clip on the timeline/);
  assert.match(inspector, /overflow-y-auto/);
  assert.match(inspector, /grid shrink-0 grid-cols-2/);
  assert.match(editor, /const PAN_PRESETS = \[/);
  assert.match(editor, /const TILT_PRESETS = \[/);
  assert.match(inspector, /label="Pan plane"/);
  assert.match(inspector, /label="Tilt plane"/);
  assert.match(inspector, /customLabel="Custom pan"/);
  assert.match(inspector, /customLabel="Custom tilt"/);
  assert.match(inspector, /hint="Pan is capped at -30[^"]*30[^"]*"/);
  assert.match(inspector, /hint="Tilt is capped at -50[^"]*50[^"]*"/);
  assert.doesNotMatch(inspector, /Reposition/);
  assert.doesNotMatch(editor, /repositioning/);
  assert.doesNotMatch(editor, /repositionUid/);
  assert.match(editor, /onPointerDownCapture=\{handleEditorPointerDownCapture\}/);
  assert.match(editor, /data-preserve-shot-selection/);
});

test('multishot timeline packs compact clips into four overlap rows', () => {
  const editor = read('app/(admin)/admin/multishots/[id]/MultishotEditor.tsx');
  const timeline = editor.slice(
    editor.indexOf('function Timeline('),
    editor.indexOf('function ShotClip('),
  );
  const clip = editor.slice(editor.indexOf('function ShotClip('));

  assert.match(editor, /const TIMELINE_ROW_COUNT = 4;/);
  assert.match(editor, /function assignTimelineRows/);
  assert.match(editor, /const rowEnds = Array\.from\(\{ length: TIMELINE_ROW_COUNT \}/);
  assert.match(editor, /rowEnds\.findIndex\(\(end\) => start >= end\)/);
  assert.match(timeline, /const shotLayouts = assignTimelineRows\(shots, specsById\)/);
  assert.match(timeline, /rowIndex=\{rowIndex\}/);
  assert.match(timeline, /overflow-x-auto pb-4 \[scrollbar-gutter:stable\]/);
  assert.match(timeline, /className="relative bg-transparent"/);
  assert.match(timeline, /type="range"/);
  assert.match(timeline, /value=\{scrubElapsed\}/);
  assert.match(timeline, /aria-label="Multishot preview time"/);
  assert.match(timeline, /cursor-ew-resize touch-none/);
  assert.match(timeline, /className="pointer-events-none absolute inset-0"/);
  assert.match(timeline, /className="absolute top-0 bottom-0 w-px/);
  assert.doesNotMatch(timeline, /repeating-linear-gradient/);
  assert.match(clip, /height: TIMELINE_ROW_HEIGHT_PX/);
  assert.match(clip, /formatSecondsLabel\(clipDuration\)/);
  assert.match(clip, /formatTimelineTimestamp\(shot\.timeOffsetSeconds\)/);
  assert.match(clip, /clipPaletteOf\(spec\)/);
});

test('multishot preview uses shared admin transport fullscreen and loading chrome', () => {
  const editor = read('app/(admin)/admin/multishots/[id]/MultishotEditor.tsx');
  const previewStage = editor.slice(
    editor.indexOf('function PreviewStage('),
    editor.indexOf('// --- Timeline'),
  );

  assert.match(editor, /usePreviewFullscreen/);
  assert.match(previewStage, /fixed inset-\[5vmin\] z-\[100\]/);
  assert.match(previewStage, /PreviewFullscreenBackdrop/);
  assert.match(previewStage, /showLoadingBar=\{false\}/);
  assert.match(previewStage, /primeSnapshots/);
  assert.match(previewStage, /primeOnCueChanges=\{false\}/);
  assert.match(previewStage, /onPrimeProgress=\{onPreviewLoadingProgress\}/);
  assert.match(previewStage, /onReady=\{onPreviewReady\}/);
  assert.match(editor, /const PREVIEW_TRANSPORT_IDLE_MS = 2000;/);
  assert.match(previewStage, /const transportVisible = !isPlaying \|\| transportActive/);
  assert.match(previewStage, /setTransportActive\(false\)/);
  assert.match(previewStage, /function handleTransportPlayPause\(\)/);
  assert.match(previewStage, /onPlayPause=\{handleTransportPlayPause\}/);
  assert.match(previewStage, /onPointerMoveCapture=\{wakePreviewTransport\}/);
  assert.match(previewStage, /transition-all duration-300/);
  assert.match(previewStage, /bottom-5 z-30/);
  assert.match(previewStage, /fullscreen=\{fullscreen\}/);
  assert.match(previewStage, /loading=\{loading\}/);
  assert.match(previewStage, /onFullscreenToggle=\{onFullscreenToggle\}/);
});
