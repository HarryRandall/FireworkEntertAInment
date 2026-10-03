/** Times the actual browser harness's Node work without launching Chromium. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewFixtures } from '../src/fixtures/index.ts';
import { effectTemplates } from '../src/templates/index.ts';
import { sprayDirections, BIRTH_TEXTURE_WIDTH } from '../src/view/spray-births.ts';
import { sprayVertex } from '../src/view/gpu-sprays.ts';
import {
  buildParityFrame,
  modifierParityFrame,
  parityError,
  feedbackFrame,
  packed,
  FIXED_TIMES_S,
  SAMPLED_SPARKS_PER_TIME,
} from '../../../tests/browser/spray-expectations.ts';

const cases = [
  ...reviewFixtures,
  ...effectTemplates.filter((entry) =>
    ['fountain', 'sparkler', 'wheel', 'silverDragon', 'glitterWillow'].includes(entry.key),
  ),
];
for (const entry of cases) {
  test(`${entry.key}: bounded parity preparation and direct seek`, () => {
    const start = performance.now();
    const frames = FIXED_TIMES_S.map((time) => buildParityFrame(entry.design, time));
    let compareMs = 0;
    for (const [index, time] of FIXED_TIMES_S.entries()) {
      const frame = frames[index];
      assert.ok(frame.births.births <= SAMPLED_SPARKS_PER_TIME);
      const replay = buildParityFrame(entry.design, time);
      assert.deepEqual(feedbackFrame(replay), feedbackFrame(frame));
      assert.deepEqual(replay.expected, frame.expected);
      const comparisonStart = performance.now();
      const result = parityError(frame.expected, frame.expected);
      assert.ok(result.worstRatio <= 1, result.message);
      compareMs += performance.now() - comparisonStart;
    }
    const payloadStart = performance.now();
    const payload = JSON.stringify({
      vertex: sprayVertex,
      directions: packed(sprayDirections()),
      width: BIRTH_TEXTURE_WIDTH,
      frames: frames.filter((frame) => frame.births.count).map(feedbackFrame),
    });
    console.log(
      JSON.stringify({
        fixture: entry.key,
        simulateMs: frames.reduce((sum, frame) => sum + frame.simulateMs, 0),
        sparkStateMs: frames.reduce((sum, frame) => sum + frame.timings.sparkStateMs, 0),
        packingMs: frames.reduce((sum, frame) => sum + frame.timings.packingMs, 0),
        payloadMs: performance.now() - payloadStart,
        payloadBytes: Buffer.byteLength(payload),
        compareMs,
        candidates: frames.reduce((sum, frame) => sum + frame.births.count, 0),
        totalMs: performance.now() - start,
      }),
    );
  });
}

test('single-pass comparison retains all lane tolerances and reports non-finite values', () => {
  const expected = [1, 2, 3, 0.5, 0.5, 0.5, 1, 0.8];
  for (let lane = 0; lane < expected.length; lane++) {
    const actual = [...expected];
    actual[lane] += 0.01;
    const error = parityError(actual, expected);
    assert.ok(error.worstRatio > 1);
    assert.match(error.message, new RegExp(`Worst lane ${lane}, row 0`));
    actual[lane] = NaN;
    assert.equal(parityError(actual, expected).worstRatio, Infinity);
  }
  assert.equal(parityError([], expected).worstRatio, Infinity);
});

test('modifier parity preparation remains bounded without a browser', () => {
  const start = performance.now();
  const frame = modifierParityFrame();
  const packingStart = performance.now();
  const payload = JSON.stringify(feedbackFrame(frame));
  const payloadMs = performance.now() - packingStart;
  const compareStart = performance.now();
  const error = parityError(frame.expected, frame.expected);
  assert.ok(error.worstRatio <= 1, error.message);
  console.log(
    JSON.stringify({
      fixture: 'modifiers',
      sparkStateMs: frame.timings.sparkStateMs,
      packingMs: frame.timings.packingMs,
      payloadBytes: Buffer.byteLength(payload),
      payloadMs,
      compareMs: performance.now() - compareStart,
      candidates: frame.births.count,
      totalMs: performance.now() - start,
    }),
  );
});
