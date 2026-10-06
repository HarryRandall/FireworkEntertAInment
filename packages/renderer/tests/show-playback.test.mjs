import assert from 'node:assert/strict';
import { test } from 'node:test';
import { syncViewerClock } from '../src/view/external-clock.ts';
import { launchPos } from '../src/sim/launch.ts';
import { effectTemplates, simulate } from '../src/index.ts';

const shell = effectTemplates.find((entry) => entry.design.kind === 'shell').design;

test('soundtrack ticks keep sound voices, while pause and scrub reset them', () => {
  let resets = 0;
  let hushes = 0;
  const viewer = { t: 0, duration: 20, playing: false, externalClock: false, invalidate() {} };
  const sound = {
    reset() {
      resets++;
    },
    hush() {
      hushes++;
    },
  };
  syncViewerClock(viewer, sound, 0, true);
  for (let frame = 1; frame <= 60; frame++) syncViewerClock(viewer, sound, frame / 60, true);
  assert.equal(resets, 1);
  assert.equal(viewer.t, 1);
  assert.equal(viewer.externalClock, true);
  syncViewerClock(viewer, sound, 8, true);
  assert.equal(resets, 2);
  syncViewerClock(viewer, sound, 8, false);
  assert.equal(resets, 3);
  assert.equal(hushes, 1);
});

test('forward aiming moves the launch and burst together without changing lift seconds', () => {
  const neutral = launchPos(shell.launch, 11, shell.launch.time_s);
  const aimed = launchPos(shell.launch, 11, shell.launch.time_s, { tilt_deg: 15 });
  assert.equal(aimed[0], neutral[0]);
  assert.equal(aimed[1], neutral[1]);
  assert.ok(aimed[2] > neutral[2]);
  assert.equal(aimed[2] - neutral[2], Math.tan((15 * Math.PI) / 180) * aimed[1]);
});

test('forward-aimed shells break at the end of their aimed launch path', () => {
  const time = shell.launch.time_s + 0.05;
  const neutral = simulate(shell, time, { sprays: false, smoke: false });
  const aimed = simulate(shell, time, { tilt_deg: 15, sprays: false, smoke: false });
  const shift = Math.tan((15 * Math.PI) / 180) * shell.launch.height_m;
  assert.equal(neutral.positions.length, aimed.positions.length);
  for (let i = 2; i < neutral.positions.length; i += 3)
    assert.ok(Math.abs(aimed.positions[i] - neutral.positions[i] - shift) < 0.0001);
});

test('mine and comet shots retain tube aiming without changing ignition', () => {
  for (const kind of ['mine', 'comet']) {
    const design = effectTemplates.find((entry) => entry.design.kind === kind).design;
    const neutral = simulate(design, 0.5, { sprays: false, smoke: false });
    const aimed = simulate(design, 0.5, { pan_deg: 20, tilt_deg: 15, sprays: false, smoke: false });
    assert.equal(neutral.kinds.length, aimed.kinds.length);
    assert.notDeepEqual(neutral.positions, aimed.positions);
  }
});
