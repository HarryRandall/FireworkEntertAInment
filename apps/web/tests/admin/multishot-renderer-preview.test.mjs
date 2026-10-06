import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
await import('../../../../scripts/renderer/register-typescript.mjs');
const { effectTemplates, shotDuration } = await import('@showcrafter/renderer');
const { multishotPreviewCues, fireworkDurationOf } =
  await import('../../app/(admin)/admin/multishots/[id]/_components/multishot-model.ts');
const { buildShowRendererShots } = await import('../../lib/shows/renderer-shots.ts');
const { resolvedShowDesign } = await import('../../lib/shows/renderer-design.ts');
const shell = effectTemplates.find((entry) => entry.design.kind === 'shell').design;
const fountain = effectTemplates.find((entry) => entry.design.kind === 'fountain').design;
const specs = new Map([
  ['shell', { id: 'shell', name: 'Shell', design: shell, durationSeconds: 1 }],
  ['fountain', { id: 'fountain', name: 'Fountain', design: fountain, durationSeconds: 1 }],
]);
const children = [
  {
    uid: 'one',
    fireworkId: 'shell',
    timeOffsetSeconds: 0,
    panDegrees: -30,
    tiltDegrees: 25,
    sequenceIndex: 1,
  },
  {
    uid: 'two',
    fireworkId: 'fountain',
    timeOffsetSeconds: 2.75,
    panDegrees: 15,
    tiltDegrees: -50,
    sequenceIndex: 7,
  },
];

test('multishot children retain offsets, designs, aiming and stable seeds across selection and reorder', () => {
  const cues = multishotPreviewCues(children, specs);
  const result = buildShowRendererShots(cues, [{ x: 0, y: 0, z: 0 }]);
  assert.equal(result.ok, true);
  assert.equal(result.shots.length, 2);
  assert.deepEqual(
    result.shots.map((shot) => shot.t0),
    [0, 2.75],
  );
  assert.deepEqual(
    result.shots.map((shot) => shot.pan_deg),
    [-30, 15],
  );
  assert.deepEqual(
    result.shots.map((shot) => shot.tilt_deg),
    [25, -50],
  );
  assert.deepEqual(
    result.shots.map((shot) => shot.seed),
    [1, 7],
  );
  assert.deepEqual(
    result.shots.map((shot) => shot.position),
    [
      [0, 0],
      [0, 0],
    ],
  );
  assert.deepEqual(
    result.shots.map((shot) => shot.design.kind),
    ['shell', 'fountain'],
  );
  assert.deepEqual(
    multishotPreviewCues([...children].reverse(), specs).map((cue) => cue.seedOverride),
    [7, 1],
  );
  assert.deepEqual(specs.get('shell').design, shell);
});

test('timeline clips use renderer lifetime and invalid child designs cannot fall back to the old engine', () => {
  for (const spec of specs.values()) {
    assert.equal(fireworkDurationOf(spec), shotDuration(resolvedShowDesign(spec, 'normal')));
  }
  const invalid = new Map([['shell', { id: 'shell', name: 'Broken', renderDesign: shell }]]);
  assert.equal(buildShowRendererShots(multishotPreviewCues(children, invalid)).ok, false);
});

test('multishot keeps cake, shared transport and fullscreen without legacy simulation or aim guides', () => {
  const stage = readFileSync(
    'app/(admin)/admin/multishots/[id]/_components/MultishotPreviewStage.tsx',
    'utf8',
  );
  const canvas = readFileSync('ui/replay/ShowRendererCanvas.tsx', 'utf8');
  assert.match(stage, /ShowRendererCanvas/);
  assert.match(stage, /prop="cake"/);
  assert.match(stage, /EditorPreviewTransport/);
  assert.match(stage, /onLoopToggle=\{onLoopToggle\}/);
  assert.match(stage, /PreviewFullscreenBackdrop/);
  assert.match(canvas, /new Viewer/);
  assert.match(canvas, /instance\.dispose\(\)/);
  assert.doesNotMatch(
    stage + canvas,
    /@showcrafter\/fireworks|\.\/FireworkReplayCanvas|legacyEditor|aimMarkers/,
  );
});

test('active preview surfaces all load the stored-design adapter', () => {
  const surfaces = [
    'app/(admin)/admin/show-presets/[id]/_components/ShowPresetReplayCanvas.tsx',
    'app/(app)/shows/_components/ShowReplayPreviewContext.tsx',
    'ui/catalogue/FireworkBrowsePreviewContext.tsx',
    'ui/marketing/landing/ShowPreviewPanel.tsx',
    'ui/replay/FireworkReplayViewer.tsx',
    'ui/replay/TemplateReplayPreview.tsx',
    'ui/replay/ReplayPanelLoadingStage.tsx',
  ];
  for (const path of surfaces) {
    const source = readFileSync(path, 'utf8');
    assert.match(source, /import\('@\/ui\/replay\/ShowRendererCanvas'\)/, path);
    assert.match(source, /\.ShowRendererCanvas/, path);
    assert.doesNotMatch(source, /import\('@\/ui\/replay\/FireworkReplayCanvas'\)/, path);
  }
});

test('whole-show playback starts at the normal zoom-out cap while product previews stay framed', () => {
  const wholeShowSurfaces = [
    'app/(app)/shows/_components/ShowReplayPreviewContext.tsx',
    'app/(admin)/admin/multishots/[id]/_components/MultishotPreviewStage.tsx',
    'app/(admin)/admin/show-presets/[id]/_components/ShowPresetEditor.tsx',
    'ui/marketing/landing/ShowPreviewPanel.tsx',
    'ui/replay/FireworkReplayViewer.tsx',
    'ui/replay/ReplayPanelLoadingStage.tsx',
    'ui/replay/TemplateReplayPreview.tsx',
  ];
  for (const path of wholeShowSurfaces)
    assert.match(readFileSync(path, 'utf8'), /startDistance="farthest"/, path);

  const canvas = readFileSync('ui/replay/ShowRendererCanvas.tsx', 'utf8');
  assert.match(canvas, /startDistance: props\.startDistance/);
  assert.match(canvas, /startDistance\?: 'framed' \| 'farthest'/);
  assert.doesNotMatch(
    readFileSync('ui/catalogue/FireworkBrowsePreviewContext.tsx', 'utf8'),
    /startDistance=/,
  );
  assert.doesNotMatch(
    readFileSync(
      'app/(admin)/admin/show-presets/[id]/_components/ShowPresetProductPicker.tsx',
      'utf8',
    ),
    /startDistance=/,
  );
});

test('the legacy canvas is restricted to video imports and the comparison harness', () => {
  const allowed = new Set([
    'app/internal/import-render/ImportRenderHarness.tsx',
    'app/(admin)/admin/imports/[id]/_components/FireworkImportPreview.tsx',
    'app/(admin)/admin/renderer-compare/_components/ComparisonPair.tsx',
  ]);
  for (const directory of ['app', 'ui']) {
    for (const relative of readdirSync(directory, { recursive: true })) {
      if (!/\.tsx?$/.test(relative)) continue;
      const path = `${directory}/${relative}`;
      const source = readFileSync(path, 'utf8');
      if (
        /from ['"]@\/ui\/replay\/FireworkReplayCanvas['"]|import\(['"]@\/ui\/replay\/FireworkReplayCanvas['"]\)/.test(
          source,
        )
      ) {
        assert.ok(allowed.has(path), `${path} must use the stored-design renderer`);
      }
    }
  }
});
