import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { compileFireworkDesign } from '../src/design.ts';
import { effectSpawnEffectStar } from '../src/effects/stars.ts';
import { createShellEffectBudget } from '../src/effects/math.ts';
import { ParticlePool } from '../src/ParticlePool.ts';
import { createSeededRng } from '../src/random.ts';

function star({ size = 10, strobe = false, obsoleteStrobe = false, burst = {}, motion = {} } = {}) {
  const design = compileFireworkDesign({
    variantOverrides: {
      stars: {
        outer: { head: { size }, burst, burstTrail: { enabled: false } },
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
      ...motion,
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

test('zero air resistance preserves authored speed without a hidden lateral cap', () => {
  const p = star({ burst: { airResistancePercent: 0 }, motion: { vx: 20, drag: 2.15 } });
  p.update(0.1, 0.1);
  assert.equal(p.vx, 20);
  assert.equal(p.x, 200);
  const resisted = star({ burst: { airResistancePercent: 100 }, motion: { vx: 20, drag: 2.15 } });
  resisted.update(0.1, 0.1);
  assert.ok(resisted.vx < p.vx);
});

test('terminal fall speed limits displacement on the first and subsequent frames', () => {
  const p = star({ burst: { terminalVelocity: 0 }, motion: { vy: -10, gravity: -2 } });
  for (let frame = 0; frame < 60; frame++) p.update(1 / 60, frame / 60);
  assert.ok(p.vy === 0);
  assert.equal(p.y, 100);
  const falling = star({
    burst: { airResistancePercent: 0, terminalVelocity: 2 },
    motion: { vy: -10, gravity: -2 },
  });
  falling.update(0.1, 0.1);
  assert.equal(falling.vy, -2);
  assert.equal(falling.y, 80);
});

test('particle shape does not change motion and pool reuse clears motion settings', () => {
  const positions = [];
  for (const shape of [-1, 0, 1, 2]) {
    const pool = new ParticlePool(1);
    const p = pool.new({
      x: 0,
      y: 1000,
      z: 0,
      vx: 12,
      vy: -8,
      vz: 9,
      size: 10,
      decay: 0,
      gravity: 0,
      airResistance: 0,
      shape,
    });
    p.update(0.1, 0.1);
    positions.push([p.x, p.y, p.z]);
    pool.new({ x: 0, y: 100, z: 0, airResistance: 0, terminalVelocity: 0 });
    const reused = pool.new({ x: 0, y: 100, z: 0 });
    assert.equal(reused.airResistance, 1);
    assert.equal(reused.terminalVelocity, Infinity);
  }
  for (const position of positions) {
    assert.deepEqual(position, positions[0]);
    assert.ok(Math.abs(position[0] - 120) < 1e-10);
    assert.equal(position[1], 920);
    assert.equal(position[2], 90);
  }
});

test('preview snapshots preserve particle air resistance and terminal speed', async () => {
  const { FireworksEngine } = await import('../src/FireworksEngine.ts');
  const engine = Object.create(FireworksEngine.prototype);
  engine.pool = new ParticlePool(2);
  engine.lights = { reset() {} };
  engine.pool.new({ x: 0, y: 100, z: 0, airResistance: 0.5, terminalVelocity: 0 });
  engine.pool.new({ x: 0, y: 100, z: 0 });
  const snapshot = engine.captureSnapshot();
  engine.restoreSnapshot(snapshot);
  assert.equal(engine.pool.particles[0].airResistance, 0.5);
  assert.equal(engine.pool.particles[0].terminalVelocity, 0);
  assert.equal(engine.pool.particles[1].terminalVelocity, Infinity);
});
