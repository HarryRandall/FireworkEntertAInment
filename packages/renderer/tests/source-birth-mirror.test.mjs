/** Separates formula errors from Float32 upload and browser arithmetic using the CPU callbacks. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { effectTemplates } from '../src/templates/index.ts';
import { birthParityFrame } from './spray-birth-expectations.ts';
import { FIXED_TIMES_S } from './spray-expectations.ts';
import { mirrorBirth } from './source-birth-mirror.mjs';

for (const key of ['wheel', 'spiral', 'fallingLeaves']) {
  test(`${key}: Float64 GLSL birth mirror agrees with original CPU source callbacks`, (context) => {
    const entry = effectTemplates.find((fixture) => fixture.key === key);
    const end = entry.design.launch?.time_s;
    const times = [...FIXED_TIMES_S, ...(end ? [end - 0.008, end, end + 0.05] : [])];
    if (key === 'wheel') times.push(0.992, 1, 1.008);
    let checked = 0;
    let worst = { error: 0 };
    let roundedWorst = { error: 0 };
    for (const time of times) {
      const frame = birthParityFrame(entry.design, time);
      for (const [row, candidate] of frame.diagnostic.candidates.entries()) {
        const expected = frame.expected.slice(row * 9, row * 9 + 9);
        const source = frame.diagnostic.sourceInputs.find(
          (input) => candidate >= input.candidateStart && candidate < input.candidateEnd,
        );
        const mirror = mirrorBirth(source, candidate);
        assert.equal(mirror.visible, Boolean(expected[7]), `Visibility at ${time}s, row ${row}`);
        assert.equal(mirror.id, expected[8]);
        if (!expected[7]) continue;
        const rounded = mirrorBirth(source, candidate, true);
        const samples = Math.max(
          source.options.fork ? 4 : 1,
          1 + Math.min(16, source.options.streak ?? 0),
        );
        const firstSample = candidate - ((candidate - source.candidateStart) % samples);
        const cpu = frame.diagnostic.cpuBirths.get(firstSample);
        assert.ok(Math.abs(mirror.age - cpu.age) < 1e-12);
        assert.ok(Math.abs(mirror.life - cpu.life) < 1e-12);
        assert.ok(Math.abs(mirror.alpha - cpu.alpha) < 1e-12);
        const values = [...mirror.origin, ...mirror.inherited, mirror.time];
        const roundedValues = [...rounded.origin, ...rounded.inherited, rounded.time];
        for (let lane = 0; lane < values.length; lane++) {
          const error = Math.abs(values[lane] - expected[lane]);
          const roundedError = Math.abs(roundedValues[lane] - expected[lane]);
          if (error > worst.error)
            worst = {
              error,
              time,
              row,
              candidate,
              lane,
              actual: values[lane],
              expected: expected[lane],
            };
          if (roundedError > roundedWorst.error)
            roundedWorst = { error: roundedError, time, row, candidate, lane };
        }
        checked++;
      }
    }
    context.diagnostic(
      JSON.stringify({ checked, Float64Worst: worst, uploadedControlsWorst: roundedWorst }),
    );
    assert.ok(checked > 0);
    // Large signed launch seeds lose sub-micro-radian bits in the unchanged CPU's angle addition.
    // This audit bound is separate from, and does not alter, any GPU parity tolerance.
    assert.ok(worst.error < 0.00001, `Float64 formula disagreement: ${JSON.stringify(worst)}`);
  });
}
