import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { compileFireworkDesign } from '../src/design.ts';
import {
  starEmissionCount,
  trailParticleLimit,
  trailParticlesPerStar,
  TRAIL_PARTICLE_BUDGET,
} from '../src/emission.ts';
import { effectSpawnEffectStar } from '../src/effects/stars.ts';
import { createShellEffectBudget } from '../src/effects/math.ts';
import { ParticlePool } from '../src/ParticlePool.ts';
import { createSeededRng } from '../src/random.ts';

const design = (overrides = {}) => compileFireworkDesign({ variantOverrides: overrides });

test('trail controls and renderer share the exact per-path budget', () => {
  const value = design({
    stars: {
      outer: { count: 78, burstTrail: { enabled: true, particlesPerStar: 2000 } },
      core: { enabled: false },
    },
  });
  assert.deepEqual(trailParticleLimit(value), { paths: 78, perStar: 307 });
  assert.equal(trailParticlesPerStar(value, 'outer'), 307);
  value.stars.outer.count = 100;
  assert.equal(trailParticleLimit(value).perStar, 240);
  value.stars.core.enabled = true;
  value.stars.core.count = 100;
  value.stars.core.burstTrail.enabled = false;
  assert.equal(trailParticleLimit(value).perStar, 240, 'no budget reserved for disabled trails');
  value.stars.core.burstTrail.enabled = true;
  assert.deepEqual(trailParticleLimit(value), { paths: 200, perStar: 120 });
  value.split.enabled = true;
  value.split.fragments = 4;
  assert.deepEqual(trailParticleLimit(value), { paths: 600, perStar: 40 });
  assert.equal(trailParticlesPerStar(value, 'outer') * 600, TRAIL_PARTICLE_BUDGET);
});

test('geometry counts include scaling, minimums, comet heads and ground emission', () => {
  const value = design({ stars: { outer: { count: 10 }, core: { enabled: false } } });
  value.geometry = 'ring';
  value.geometryTuning.ring.countPercent = 200;
  assert.equal(starEmissionCount(value, 'outer'), 20);
  value.geometry = 'single_tail';
  assert.equal(starEmissionCount(value, 'outer'), 1);
  value.geometry = 'upward_fan';
  value.geometryTuning.upwardFan.countPercent = 50;
  value.geometryTuning.upwardFan.minCount = 20;
  assert.equal(starEmissionCount(value, 'outer'), 20);
  value.geometry = 'fountain';
  value.shellLife = 2;
  value.geometryTuning.fountain.durationPercent = 100;
  value.geometryTuning.fountain.durationMinSeconds = 0.1;
  value.geometryTuning.fountain.durationMaxSeconds = 10;
  value.geometryTuning.fountain.minRatePerSecond = 1;
  value.geometryTuning.fountain.ratePercent = 100;
  assert.equal(starEmissionCount(value, 'outer'), 20);
  assert.equal(starEmissionCount(value, 'core'), 0);
});

function emitSlowTrail(amount) {
  const value = design({
    crackle: { enabled: false },
    split: { enabled: false },
    stars: {
      outer: {
        count: 1,
        burstTrail: {
          enabled: true,
          particlesPerStar: amount,
          lifetime: { mode: 'fixed', baseSeconds: 2, variationPercent: 0 },
          flicker: { chance: 0 },
        },
      },
      core: { enabled: false },
    },
  });
  const pool = new ParticlePool(5000);
  const budget = createShellEffectBudget();
  effectSpawnEffectStar(
    { pp: pool, sh: {}, lights: {}, audible: false },
    {
      design: value,
      budget,
      rng: createSeededRng(7),
      audible: false,
      x: 0,
      y: 0,
      z: 0,
      vx: 0.3,
      vy: 0,
      vz: 0,
      life: 1,
      gravity: 0,
      drag: 0,
      color: new THREE.Color(1, 1, 1),
    },
  );
  for (let frame = 0; frame < 70; frame++) {
    const active = [...pool.aliveIndices.slice(0, pool.aliveCount)];
    for (const slot of active) pool.particles[slot].update(1 / 60, frame / 60);
    pool.compactAliveMax();
  }
  return TRAIL_PARTICLE_BUDGET - budget.trailParticlesRemaining;
}

test('increasing trail particles still increases density on short slow paths', () => {
  const sparse = emitSlowTrail(300);
  const dense = emitSlowTrail(600);
  assert.ok(sparse > 100, `sparse: ${sparse}`);
  assert.ok(dense > sparse * 1.7, `${sparse} -> ${dense}`);
  assert.ok(dense <= 600);
});
