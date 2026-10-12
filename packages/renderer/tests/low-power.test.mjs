/** Low-power device detection and the 30 fps frame cap. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { frameDue, isLowPowerDevice, lowPowerFrameDue } from '../src/view/low-power.ts';

test('touch, data saving and weak hardware count as low power; unknown hints do not', () => {
  assert.equal(isLowPowerDevice({ coarsePointer: true }), true);
  assert.equal(isLowPowerDevice({ coarsePointer: false, saveData: true }), true);
  assert.equal(isLowPowerDevice({ coarsePointer: false, cores: 4 }), true);
  assert.equal(isLowPowerDevice({ coarsePointer: false, memoryGb: 2 }), true);
  assert.equal(isLowPowerDevice({ coarsePointer: false, cores: 10, memoryGb: 16 }), false);
  assert.equal(isLowPowerDevice({ coarsePointer: false }), false);
});

test('a 60 Hz display draws every second refresh and the first frame always draws', () => {
  const refresh = 1000 / 60;
  let last = 0;
  let draws = 0;
  for (let frame = 1; frame <= 60; frame++) {
    const now = frame * refresh;
    if (lowPowerFrameDue(last, now)) {
      draws++;
      last = now;
    }
  }
  assert.equal(draws, 30);
  assert.equal(lowPowerFrameDue(0, 5), true);
});

test('full-power viewers always draw; low-power viewers are capped per viewer', () => {
  const full = {};
  const capped = {};
  const other = {};
  assert.equal(frameDue(full, false, 1), true);
  assert.equal(frameDue(full, false, 2), true);
  assert.equal(frameDue(capped, true, 100), true);
  assert.equal(frameDue(capped, true, 110), false);
  assert.equal(frameDue(other, true, 110), true);
  assert.equal(frameDue(capped, true, 140), true);
});
