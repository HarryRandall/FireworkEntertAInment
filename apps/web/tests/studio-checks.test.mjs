/** Simulation-backed checks cover resolved adjustments, warning semantics and budget refusal. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { effectTemplates, simulate, shotDuration } from '@showcrafter/fireworks';
import { authoredChecks, measureParticlePeak, PARTICLE_BUDGET } from '../lib/studio/checks.ts';
import { measuredShotTimes, referenceTime } from '../lib/studio/reference.ts';

const peony = effectTemplates.find((item) => item.key === 'peony').design;
test('peak counts live simulation particles and smoke across the entire shot', () => {
  const before = structuredClone(peony);
  const result = measureParticlePeak(peony);
  // Golden live CPU count for the fixed peony seed, including its smoke puffs.
  assert.equal(result.count, 2986);
  assert.equal(result.exceeded, false);
  const atPeak = simulate(peony, result.timeS);
  assert.equal(result.count, atPeak.kinds.length + atPeak.smoke.alphas.length);
  assert.deepEqual(peony, before);
});
test('a later larger break is measured beyond the first developed burst', () => {
  const document = structuredClone(peony);
  const later = structuredClone(document.breaks[0]);
  later.at_s = shotDuration(peony) + 1;
  later.layers[0].count = 300;
  document.breaks.push(later);
  const result = measureParticlePeak(document);
  assert.ok(result.count > 2986);
  assert.ok(result.timeS > document.launch.time_s + later.at_s);
});
test('dense authored design blocks publishing without hiding the measured lower bound', () => {
  const document = structuredClone(peony);
  const layer = document.breaks[0].layers[0];
  layer.count = 10000;
  layer.head.size = 3;
  layer.trail.sparks = 0;
  const result = measureParticlePeak(document);
  assert.equal(result.exceeded, true);
  assert.ok(result.count > PARTICLE_BUDGET);
});
test('missing names and unusual values are advisory and include hidden authored groups', () => {
  const document = structuredClone(peony);
  const layer = document.breaks[0].layers[0];
  layer.name = '  ';
  layer.hidden = true;
  layer.life_s = 5;
  layer.count = 1;
  document.launch.height_m = 120;
  const checks = authoredChecks(document, '');
  assert.deepEqual(
    checks.filter((item) => !item.passed).map((item) => item.id),
    ['names', 'height', 'burn', 'readability'],
  );
});
test('reference clock accepts measured onsets, clamps either end and rejects unknown shot data', () => {
  assert.deepEqual(measuredShotTimes([{ t_ms: 2200, confidence: 0.9 }, { t_ms: 300 }]), [0.3, 2.2]);
  assert.throws(() => measuredShotTimes([{ t_ms: 'bad' }]));
  assert.throws(() => measuredShotTimes([{ t_ms: -1 }]));
  assert.equal(referenceTime(1, 10, 2.2), 3.2);
  assert.equal(referenceTime(15, 10), 10);
  assert.equal(referenceTime(-1, 10), 0);
});
