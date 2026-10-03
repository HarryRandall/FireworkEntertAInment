import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GENERATED_LAUNCH_INTERVAL_SECONDS, scheduleImpactWithLift } from '../src/index.ts';

test('impact clock launches early so the burst lands on the musical target', () => {
  const timing = scheduleImpactWithLift(12.345, 2.137);

  assert.deepEqual(timing, {
    impactTimeSeconds: 12.345,
    launchTimeSeconds: 10.208,
    liftTimeSeconds: 2.137,
  });
  assert.equal(timing.launchTimeSeconds + timing.liftTimeSeconds, timing.impactTimeSeconds);
});

test('ground effects launch on impact and impossible opening aerial hits are skipped', () => {
  assert.deepEqual(scheduleImpactWithLift(4.25, 0), {
    impactTimeSeconds: 4.25,
    launchTimeSeconds: 4.25,
    liftTimeSeconds: 0,
  });
  assert.equal(scheduleImpactWithLift(1, 1.5), null);
  assert.equal(scheduleImpactWithLift(Number.NaN, 1), null);
});

test('independent ignitions at one launch position are half a second apart', () => {
  assert.equal(GENERATED_LAUNCH_INTERVAL_SECONDS, 0.5);
});
