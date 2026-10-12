import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compileFireworkDesign } from '../src/design.ts';
import {
  starEmissionCount,
  trailParticleLimit,
  trailParticlesPerStar,
  TRAIL_PARTICLE_BUDGET,
} from '../src/emission.ts';

const design = (overrides = {}) => compileFireworkDesign({ variantOverrides: overrides });

test('trail controls keep the exact per-path budget', () => {
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
