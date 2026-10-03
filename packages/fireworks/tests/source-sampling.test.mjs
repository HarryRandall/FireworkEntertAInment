/** Sampled birth boundaries reconstruct CPU output without changing other particles. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate, sparkState, ParticleKind } from '../src/sim/index.ts';
import { sprayCases } from './spray-cases.mjs';

function particleRows(frame) {
  return Array.from(frame.kinds, (kind, index) => [
    kind,
    ...frame.positions.slice(index * 3, index * 3 + 3),
    ...frame.colours.slice(index * 3, index * 3 + 3),
    frame.sizes[index],
    frame.alphas[index],
  ]);
}
function sortedRows(rows) {
  return rows.map((row) => JSON.stringify(row)).sort();
}

test('sampled births reconstruct CPU points while retaining every non-spray particle', () => {
  const scratch = new Float64Array(17 * 8);
  for (const { name, design, times } of sprayCases()) {
    for (const time of times) {
      const sprayRows = [];
      const frame = simulate(design, time, {
        sprayBirth(slot, origin, inherited, alpha, now, options) {
          const count = sparkState(
            slot.id,
            slot.age,
            slot.life,
            now,
            ...origin,
            ...inherited,
            alpha,
            options,
            scratch,
          );
          for (let index = 0; index < count; index++) {
            const row = scratch.subarray(index * 8, index * 8 + 8);
            if (row[7] > 0.004) sprayRows.push([ParticleKind.Spark, ...new Float32Array(row)]);
          }
        },
      });
      assert.deepEqual(
        sortedRows([...particleRows(frame), ...sprayRows]),
        sortedRows(particleRows(simulate(design, time))),
        `${name} at ${time}s`,
      );
    }
  }
});
