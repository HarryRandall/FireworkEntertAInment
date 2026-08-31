/** Regression guards for compositor-safe rounded replay stages. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');

test('the live WebGL replay surface owns the card clipping radius', () => {
  const viewer = read('app/components/app/FireworkReplayViewer.tsx');
  const canvas = read('app/components/app/FireworkReplayCanvas.tsx');

  assert.match(viewer, /group\/replay overflow-hidden rounded-\[inherit\]/);
  assert.match(
    canvas,
    /absolute top-0 bottom-0 h-full overflow-hidden rounded-\[inherit\] bg-black/,
  );
});

test('replay loading layers preserve the same rounded clipping', () => {
  const backdrop = read('app/components/app/ReplayStageBackdrop.tsx');
  const loadingStage = read('app/components/app/ReplayPanelLoadingStage.tsx');
  const skeletons = read('app/components/app/RouteSkeletons.tsx');

  assert.match(backdrop, /overflow-hidden rounded-\[inherit\] bg-\[#020409\]/);
  assert.match(loadingStage, /overflow-hidden rounded-\[inherit\] bg-\[#020409\]/);
  assert.match(skeletons, /min-h-\[520px\] overflow-hidden rounded-\[inherit\] bg-\[#020409\]/);
});
