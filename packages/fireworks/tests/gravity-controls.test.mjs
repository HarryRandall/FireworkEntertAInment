import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { RENDERER_GEOMETRIES, isGroundGeometry } from '../src/behaviours.ts';
import { compileFireworkDesign } from '../src/design.ts';
import { effectDetonate } from '../src/effects/burst.ts';
import { effectFire } from '../src/effects/launch.ts';
import { effectSplitCrossette } from '../src/effects/secondary.ts';
import { createShellEffectBudget } from '../src/effects/math.ts';
import { ParticlePool } from '../src/ParticlePool.ts';
import { createSeededRng } from '../src/random.ts';

const carrier = { x: 0, y: 100, z: 0, vx: 0, vy: 0, vz: 0 };
function designFor(geometry, gravity, overrides = {}) {
  const layer = {
    enabled: true,
    count: 10,
    burst: { gravity, airResistancePercent: 0, life: [5, 5] },
    burstTrail: { enabled: false },
  };
  return compileFireworkDesign({
    variantOverrides: {
      geometry,
      launch: { smoke: { enabled: false } },
      stars: { outer: layer, core: layer },
      split: { enabled: false },
      crackle: { enabled: false },
      geometryTuning: { waterfall: { gravityBase: Math.min(0, gravity[0]), gravityVariation: 0 } },
      ...overrides,
    },
  });
}
function spawn(design) {
  const pp = new ParticlePool(10_000);
  const context = { pp, sh: {}, lights: { newLight() {}, setHemi() {} }, audible: false };
  const rng = createSeededRng(421);
  if (isGroundGeometry(design.geometry)) {
    effectFire(context, design, carrier, { rng, audible: false });
    // Let timed ground emitters release at least one star in each layer.
    for (let frame = 0; frame < 60; frame++) {
      for (let i = 0; i < pp.aliveCount; i++)
        pp.particles[pp.aliveIndices[i]].update(1 / 60, frame / 60);
      pp.compactAliveMax();
    }
  } else {
    effectDetonate(
      context,
      carrier,
      0,
      0,
      design,
      new THREE.Color(1, 0, 0),
      1,
      rng,
      false,
      createShellEffectBudget(),
    );
  }
  const stars = Array.from(
    { length: pp.aliveCount },
    (_, index) => pp.particles[pp.aliveIndices[index]],
  ).filter((p) => p.shape >= 2);
  assert.ok(stars.length > 0, `${design.geometry} emits stars`);
  return stars;
}

test('zero gravity produces no vertical acceleration in every shape', () => {
  for (const geometry of RENDERER_GEOMETRIES) {
    const stars = spawn(designFor(geometry, [0, 0]));
    for (const p of stars) {
      assert.equal(p.gravity, 0, geometry);
      const velocity = p.vy;
      p.update(1 / 60, 1);
      assert.equal(
        p.vy,
        velocity,
        `${geometry} keeps its vertical velocity without gravity or drag`,
      );
    }
  }
});

test('fixed gravity has no hidden jitter, floor or multiplier saturation', () => {
  for (const [geometry, group] of [
    ['sphere', null],
    ['ring', null],
    ['crown', null],
    ['weeping', 'weeping'],
    ['falling_tail', 'fallingTail'],
    ['pearls', 'pearls'],
    ['fish', 'fish'],
    ['whirl', 'whirl'],
  ]) {
    for (const gravity of [-2, 0.2, 1]) {
      const design = designFor(
        geometry,
        [gravity, gravity],
        group
          ? {
              geometryTuning: { [group]: { gravityPercent: 300 } },
            }
          : {},
      );
      const expected = gravity * (group ? 3 : 1);
      for (const p of spawn(design)) assert.equal(p.gravity, expected, geometry);
    }
  }
});

test('gravity variation stays inside each independent layer range', () => {
  const design = designFor('sphere', [-0.6, -0.2]);
  design.stars.core.burst.gravity = [0.1, 0.3];
  const stars = spawn(design);
  const outer = stars.filter((p) => p.shape < 3);
  const inner = stars.filter((p) => p.shape >= 3);
  assert.equal(outer.length, 10);
  assert.equal(inner.length, 10);
  assert.ok(outer.every((p) => p.gravity >= -0.6 && p.gravity <= -0.2));
  assert.ok(inner.every((p) => p.gravity >= 0.1 && p.gravity <= 0.3));
  assert.ok(new Set(outer.map((p) => p.gravity)).size > 1);
});

test('split fragments inherit the parent gravity without a second random draw or reduction', () => {
  const design = designFor('split_cross', [-0.6, -0.2]);
  for (const gravity of [0, -0.45, 0.3]) {
    const pp = new ParticlePool(100);
    effectSplitCrossette(
      { pp, sh: {}, lights: {}, audible: false },
      { ...carrier, gravity },
      0,
      0,
      design,
      new THREE.Color(1, 0, 0),
      createSeededRng(12),
      false,
      createShellEffectBudget(),
    );
    assert.equal(pp.aliveCount, design.split.fragments);
    for (let i = 0; i < pp.aliveCount; i++)
      assert.equal(pp.particles[pp.aliveIndices[i]].gravity, gravity);
  }
});
