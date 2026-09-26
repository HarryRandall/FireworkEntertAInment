import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { compileFireworkDesign } from '../src/design.ts';
import { effectSpawnWaterfall } from '../src/effects/secondary.ts';
import { createShellEffectBudget } from '../src/effects/math.ts';
import { ParticlePool } from '../src/ParticlePool.ts';
import { createSeededRng } from '../src/random.ts';

test('waterfall width stays centred and independent of both layer counts', () => {
  for (const width of [0, 136.4, 1200]) {
    for (const count of [1, 2, 10, 200]) {
      const design = compileFireworkDesign({
        variantOverrides: {
          geometry: 'waterfall',
          geometryTuning: { waterfall: { width, scatterX: 0 } },
          stars: {
            outer: { count, burstTrail: { enabled: false } },
            core: { enabled: true, count: 3, burstTrail: { enabled: false } },
          },
        },
      });
      const pp = new ParticlePool(1000);
      effectSpawnWaterfall(
        { pp, sh: {}, lights: {} },
        { x: 100, y: 100, z: 0 },
        design,
        new THREE.Color(1, 1, 1),
        createSeededRng(123),
        false,
        createShellEffectBudget(),
      );
      const xs = [...pp.aliveIndices.slice(0, pp.aliveCount)].map((slot) => pp.particles[slot].x);
      assert.equal(xs.length, count + 3);
      for (const [layer, expectedCount] of [
        [xs.slice(0, count), count],
        [xs.slice(count), 3],
      ]) {
        const extent = expectedCount === 1 ? 0 : width / 2;
        assert.ok(Math.abs(Math.min(...layer) - (100 - extent)) < 1e-9);
        assert.ok(Math.abs(Math.max(...layer) - (100 + extent)) < 1e-9);
      }
    }
  }
});
