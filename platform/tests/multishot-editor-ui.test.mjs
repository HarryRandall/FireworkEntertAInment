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
  const previewGridIndex = editor.indexOf("'grid shrink-0 items-stretch gap-5'");
  const timelineIndex = editor.indexOf('<Timeline');
  const metaBarIndex = editor.indexOf('<MetaBar');

  assert.match(metaBar, /sm:flex-row sm:items-end sm:justify-between/);
  assert.ok(previewGridIndex > -1);
  assert.ok(timelineIndex > previewGridIndex);
  assert.ok(metaBarIndex > timelineIndex);
  assert.ok(titleIndex > -1);
  assert.ok(durationBadgeIndex > titleIndex);
  assert.ok(shotBadgeIndex > durationBadgeIndex);
  assert.ok(descriptionIndex > shotBadgeIndex);
  assert.ok(editButtonIndex > descriptionIndex);
});

test('multishot inspector only opens for a selected shot', () => {
  const editor = read('app/(admin)/admin/multishots/[id]/MultishotEditor.tsx');
  const inspector = editor.slice(editor.indexOf('function Inspector('));

  assert.doesNotMatch(inspector, /Shot inspector/);
  assert.doesNotMatch(inspector, /No shot selected/);
  assert.match(editor, /selectedShot \? 'xl:grid-cols-\[minmax\(0,1fr\)_340px\]' : 'grid-cols-1'/);
  assert.match(editor, /selectedShot \? \(\s*<Inspector/);
  assert.match(editor, /fullWidth=\{!selectedShot\}/);
  assert.doesNotMatch(editor, /hasShots=\{shots\.length > 0\}/);
  assert.doesNotMatch(inspector, /Select a clip on the timeline/);
  assert.match(inspector, /overflow-y-auto/);
  assert.match(inspector, /grid shrink-0 grid-cols-2/);
  assert.match(editor, /const PAN_PRESETS = \[/);
  assert.match(editor, /const TILT_PRESETS = \[/);
  assert.match(
    inspector,
    /<SliderField[\s\S]*\/>\s*<div className="space-y-4">\s*<AnglePlaneControl/,
  );
  assert.match(inspector, /label="Pan plane"/);
  assert.match(inspector, /label="Tilt plane"/);
  assert.doesNotMatch(inspector, />\s*Aim\s*</);
  assert.doesNotMatch(inspector, /Custom pan/);
  assert.doesNotMatch(inspector, /Custom tilt/);
  assert.match(
    inspector,
    /<span className="truncate">\{label\}<\/span>\s*<InfoTooltip text=\{hint\} \/>/,
  );
  assert.match(inspector, /<Slider[\s\S]*aria-label=\{`\$\{label\} angle`\}/);
  assert.match(inspector, /hint="Pan is capped at -30[^"]*30[^"]*"/);
  assert.match(inspector, /hint="Tilt is capped at -50[^"]*50[^"]*"/);
  assert.doesNotMatch(inspector, /Reposition/);
  assert.doesNotMatch(editor, /repositioning/);
  assert.doesNotMatch(editor, /repositionUid/);
  assert.match(editor, /onPointerDownCapture=\{handleEditorPointerDownCapture\}/);
  assert.match(inspector, /<aside\s+data-preserve-shot-selection/);
});

test('multishot selection stays active on preview, clips, inspector controls, and firework menu items', () => {
  const editor = read('app/(admin)/admin/multishots/[id]/MultishotEditor.tsx');
  const keepSelector = editor.slice(
    editor.indexOf('const SHOT_SELECTION_KEEP_SELECTOR = ['),
    editor.indexOf('type SaveState'),
  );
  const previewStage = editor.slice(
    editor.indexOf('function PreviewStage('),
    editor.indexOf('// --- Timeline'),
  );
  const timeline = editor.slice(
    editor.indexOf('function Timeline('),
    editor.indexOf('function ShotClip('),
  );
  const clip = editor.slice(
    editor.indexOf('function ShotClip('),
    editor.indexOf('// --- Inspector'),
  );

  assert.match(keepSelector, /\[data-preserve-shot-selection\]/);
  assert.match(keepSelector, /\[data-slot="select-content"\]/);
  assert.match(keepSelector, /\[data-slot="select-item"\]/);
  assert.doesNotMatch(keepSelector, /'button'/);
  assert.doesNotMatch(keepSelector, /'input'/);
  assert.match(previewStage, /<section\s+data-preserve-shot-selection/);
  assert.doesNotMatch(timeline, /<section\s+data-preserve-shot-selection/);
  assert.match(clip, /<button[\s\S]*data-preserve-shot-selection/);
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
  assert.match(editor, /const INSPECTOR_RAIL_WIDTH_PX = 340;/);
  assert.match(editor, /const INSPECTOR_RAIL_GAP_PX = 20;/);
  assert.match(
    editor,
    /const INSPECTOR_RENDER_OVERSCAN_PX = INSPECTOR_RAIL_WIDTH_PX \+ INSPECTOR_RAIL_GAP_PX/,
  );
  assert.match(
    previewStage,
    /renderOverscanPx=\{!fullscreen && !fullWidth \? INSPECTOR_RENDER_OVERSCAN_PX : 0\}/,
  );
  assert.match(previewStage, /: 'relative h-\[560px\]'/);
  assert.match(previewStage, /<div className="relative h-full w-full">/);
  assert.doesNotMatch(previewStage, /aspect-video|cameraViewOffset/);
  assert.doesNotMatch(editor, /data-multishot-/);
  assert.match(editor, /'grid shrink-0 items-stretch gap-5'/);
  assert.match(previewStage, /<div className=\{fullscreen \? 'contents' : 'relative'\}>/);
  assert.doesNotMatch(previewStage, /h-32 shrink-0/);
  assert.match(editor, /className="flex flex-col gap-3 rounded-lg/);
  assert.doesNotMatch(editor, /mt-\[28rem\]|mt-40|mb-32|mb-14/);
  assert.match(
    previewStage,
    /const transportVisible = previewActive && \(!isPlaying \|\| transportActive\)/,
  );
  assert.match(previewStage, /const \[previewActive, setPreviewActive\] = useState\(false\)/);
  assert.match(previewStage, /function hidePreviewTransport\(\)/);
  assert.match(previewStage, /setPreviewActive\(false\)/);
  assert.match(previewStage, /setTransportActive\(false\)/);
  assert.match(previewStage, /function handleTransportPlayPause\(\)/);
  assert.match(previewStage, /onPlayPause=\{handleTransportPlayPause\}/);
  assert.match(previewStage, /onPointerEnter=\{wakePreviewTransport\}/);
  assert.match(previewStage, /onPointerMoveCapture=\{wakePreviewTransport\}/);
  assert.match(previewStage, /onPointerLeave=\{hidePreviewTransport\}/);
  assert.match(previewStage, /transition-all duration-300/);
  assert.match(previewStage, /fullWidth/);
  assert.match(previewStage, /h-\[560px\]/);
  assert.match(editor, /max-h-\[560px\]/);
  assert.match(previewStage, /absolute inset-x-0 bottom-5 z-30/);
  assert.match(previewStage, /fullscreen=\{fullscreen\}/);
  assert.match(previewStage, /loading=\{loading\}/);
  assert.match(previewStage, /onFullscreenToggle=\{onFullscreenToggle\}/);
});
