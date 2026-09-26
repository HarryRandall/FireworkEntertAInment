import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { compileFireworkDesign } from '../src/design.ts';
import { effectSpawnEffectStar } from '../src/effects/stars.ts';
import { createShellEffectBudget } from '../src/effects/math.ts';
import { ParticlePool } from '../src/ParticlePool.ts';
import { createSeededRng } from '../src/random.ts';

function star({ size = 10, strobe = false, obsoleteStrobe = false } = {}) {
  const design = compileFireworkDesign({
    variantOverrides: {
      stars: {
        outer: { head: { size }, burstTrail: { enabled: false } },
        core: { enabled: false },
      },
      strobe: { enabled: strobe, frequencyHz: 2, dutyCycle: 0.5, dimPercent: 0, desync: 0 },
      crackle: { enabled: false },
      split: { enabled: false },
    },
  });
  if (obsoleteStrobe) design.stars.outer.burst.flairSizeStrobe = [0, 100];
  const pool = new ParticlePool(10);
  effectSpawnEffectStar(
    { pp: pool, sh: {}, lights: {}, audible: false },
    {
      design,
      budget: createShellEffectBudget(),
      rng: createSeededRng(42),
      audible: false,
      x: 0,
      y: 100,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 10,
      gravity: 0,
      drag: 0,
      color: new THREE.Color(1, 0, 0),
    },
  );
  return pool.particles[0];
}

test('small star sizes remain distinct and burn for the authored lifetime', () => {
  const small = star({ size: 10 });
  const large = star({ size: 20 });
  assert.equal(small.size, 10);
  assert.equal(large.size, 20);
  for (let frame = 0; frame < 480; frame++) small.update(1 / 60, frame / 60);
  assert.equal(small.alive, true);
  assert.equal(small.size, 10);
});

test('a zero-size dark phase hides a star without killing it', () => {
  const p = star({ strobe: true });
  p.update(0.3, 0.3);
  assert.equal(p.alpha, 0);
  assert.equal(p.alive, true);
  p.update(0.25, 0.55);
  assert.ok(p.alpha > 0);
  assert.equal(p.alive, true);
});

test('disabled strobe stays off even if obsolete raw settings are present', () => {
  const p = star({ obsoleteStrobe: true });
  p.update(0.3, 0.3);
  assert.equal(p.size, 10);
  assert.ok(p.alpha > 0);
});
