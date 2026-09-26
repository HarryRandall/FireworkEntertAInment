import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compileFireworkDesign } from '../../fireworks/src/design.ts';
import { effectDetonate } from '../../fireworks/src/effects/burst.ts';
import { createShellEffectBudget } from '../../fireworks/src/effects/math.ts';
import { ParticlePool } from '../../fireworks/src/ParticlePool.ts';
import { createSeededRng } from '../../fireworks/src/random.ts';
import { starMovementAvailability } from '../src/availability.ts';

function burstParticles(design) {
  const pool = new ParticlePool(10_000);
  const context = { pp: pool, sh: {}, lights: { setHemi() {} }, audible: false };
  effectDetonate(
    context,
    { x: 0, y: 100, z: 0, vx: 0, vy: 0, vz: 0 },
    0,
    0,
    design,
    { r: 1, g: 1, b: 1 },
    1,
    createSeededRng(123),
    false,
    createShellEffectBudget(),
  );
  return Array.from({ length: pool.aliveCount }, (_, index) => {
    const p = pool.particles[pool.aliveIndices[index]];
    return [p.x, p.y, p.z, p.vx, p.vy, p.vz, p.gravity, p.life, p.size];
  });
}

test('waterfall replaces generic speed and gravity; other movement controls remain available', () => {
  const design = compileFireworkDesign({ variantOverrides: { geometry: 'waterfall' } });
  const before = structuredClone(design);
  const available = starMovementAvailability(design);
  assert.equal(available.count, true);
  assert.equal(available.speed, false);
  assert.equal(available.gravity, false);
  const baseline = burstParticles(design);
  for (const layer of ['outer', 'core']) {
    design.stars[layer].burst.speed = [15, 20];
    design.stars[layer].burst.gravity = [0.5, 1];
  }
  assert.deepEqual(burstParticles(design), baseline);
  design.geometryTuning.waterfall.fallSpeed += 1;
  assert.notDeepEqual(burstParticles(design), baseline);
  assert.deepEqual(starMovementAvailability(before), available);
});

test('comet emits one head per enabled layer regardless of the stored star count', () => {
  const design = compileFireworkDesign({
    variantOverrides: { geometry: 'single_tail', stars: { core: { enabled: true } } },
  });
  assert.equal(starMovementAvailability(design).count, false);
  const baseline = burstParticles(design);
  assert.equal(baseline.length, 2);
  design.stars.outer.count = 99;
  design.stars.core.count = 75;
  assert.deepEqual(burstParticles(design), baseline);
  design.geometry = 'sphere';
  assert.deepEqual(starMovementAvailability(design), {
    count: true,
    speed: true,
    gravity: true,
    reason: null,
  });
  assert.equal(design.stars.outer.count, 99);
  assert.equal(design.stars.core.count, 75);
});
