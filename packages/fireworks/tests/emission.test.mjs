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

test('layer counts are exact across shapes and fountain counts derive from rate and duration', () => {
  const value = design({
    stars: { outer: { count: 10, emissionRate: 12.5 }, core: { enabled: false } },
  });
  for (const geometry of ['ring', 'upward_fan', 'roman_candle', 'whirl', 'waterfall']) {
    value.geometry = geometry;
    assert.equal(starEmissionCount(value, 'outer'), 10);
  }
  value.geometry = 'single_tail';
  assert.equal(starEmissionCount(value, 'outer'), 1);
  value.geometry = 'fountain';
  value.geometryTuning.fountain.durationSeconds = 2;
  assert.equal(starEmissionCount(value, 'outer'), 25);
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

// Count particles at creation, so short-lived sparks and pool-slot reuse cannot
// hide either a missing emission or an extra one.
async function emittedStars(geometry, count, rate, duration, dt = 1 / 60) {
  const { RENDERER_GEOMETRIES, isGroundGeometry } = await import('../src/behaviours.ts');
  const { effectDetonate } = await import('../src/effects/burst.ts');
  const { effectFire } = await import('../src/effects/launch.ts');
  assert.ok(RENDERER_GEOMETRIES.includes(geometry));
  const value = design({
    geometry,
    launch: { smoke: { enabled: false } },
    crackle: { enabled: false },
    split: { enabled: false },
    stars: {
      outer: { enabled: true, count, emissionRate: rate, burstTrail: { enabled: false } },
      core: {
        enabled: true,
        count: count + 1,
        emissionRate: rate + 1,
        burstTrail: { enabled: false },
      },
    },
    geometryTuning: {
      fountain: { durationSeconds: duration },
      romanCandle: { durationSeconds: duration },
    },
  });
  const pp = new ParticlePool(10000);
  const totals = [0, 0];
  const allocate = pp.new.bind(pp);
  pp.new = (options) => {
    if (options.shape >= 2) totals[Math.floor(options.shape) - 2]++;
    return allocate(options);
  };
  const ctx = { pp, sh: {}, lights: { newLight() {}, setHemi() {} }, audible: false };
  const origin = { x: 0, y: 100, z: 0, vx: 0, vy: 0, vz: 0 };
  const rng = createSeededRng(987);
  if (isGroundGeometry(geometry)) effectFire(ctx, value, origin, { rng, audible: false });
  else
    effectDetonate(
      ctx,
      origin,
      0,
      0,
      value,
      new THREE.Color(1, 1, 1),
      1,
      rng,
      false,
      createShellEffectBudget(),
    );
  for (let frame = 0; frame * dt < duration + 2; frame++) {
    const slots = [...pp.aliveIndices.slice(0, pp.aliveCount)];
    for (const slot of slots) pp.particles[slot].update(dt, frame * dt);
    pp.compactAliveMax();
  }
  return { value, totals };
}

test('every burst shape and Roman candle emits the exact count without a hidden minimum', async () => {
  const { RENDERER_GEOMETRIES } = await import('../src/behaviours.ts');
  for (const geometry of RENDERER_GEOMETRIES.filter((g) => g !== 'fountain')) {
    for (const count of [1, 10, 199]) {
      const { totals } = await emittedStars(geometry, count, 10, 0.5);
      assert.deepEqual(totals, geometry === 'single_tail' ? [1, 1] : [count, count + 1], geometry);
    }
  }
});

test('fountains emit the authored independent rates for exactly the authored duration', async () => {
  for (const dt of [1 / 120, 1 / 60, 1 / 24, 0.7]) {
    for (const [rate, duration] of [
      [1, 0.1],
      [12.5, 2],
      [126, 7.8],
      [599, 0.25],
    ]) {
      const { value, totals } = await emittedStars('fountain', 10, rate, duration, dt);
      assert.deepEqual(
        totals,
        [Math.floor(rate * duration + 1e-9), Math.floor((rate + 1) * duration + 1e-9)],
        `${rate}/s for ${duration}s at ${dt}s steps`,
      );
      assert.equal(starEmissionCount(value, 'outer'), totals[0]);
      assert.equal(starEmissionCount(value, 'core'), totals[1]);
    }
  }
});

test('ground timing uses duration independently of layer rate and shell flight time', async () => {
  const { estimateFireworkDesignTiming, applyFireworkTimelineEdit } =
    await import('../src/timing.ts');
  const value = design({
    geometry: 'fountain',
    geometryTuning: { fountain: { durationSeconds: 3 } },
  });
  const before = estimateFireworkDesignTiming(value);
  value.stars.outer.emissionRate = 1;
  value.shellLife = 60;
  assert.deepEqual(estimateFireworkDesignTiming(value), before);
  value.geometryTuning.fountain.durationSeconds = 5;
  assert.equal(estimateFireworkDesignTiming(value).endSeconds, before.endSeconds + 2);
  const patch = {};
  applyFireworkTimelineEdit(
    patch,
    value,
    'total',
    estimateFireworkDesignTiming(value).endSeconds * 1.25,
  );
  assert.ok(patch.geometryTuning.fountain.durationSeconds > 5);
  assert.equal(patch.shellLife, undefined);
  assert.equal(patch.stars?.outer?.emissionRate, undefined);
});
