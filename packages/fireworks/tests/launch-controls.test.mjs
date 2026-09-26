import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { compileFireworkDesign, DEFAULT_LIFT_VELOCITY } from '../src/design.ts';
import { effectFire, effectSpawnGuidedLaunchShell } from '../src/effects/launch.ts';
import { ParticlePool } from '../src/ParticlePool.ts';
import { createSeededRng } from '../src/random.ts';

function launch({ count = 100, pattern = 'fibonacci', size = 110, speed } = {}) {
  const design = compileFireworkDesign({
    variantOverrides: {
      pattern,
      ...(speed == null ? {} : { liftVelocity: speed }),
      launch: {
        shell: { size },
        smoke: { enabled: false },
        liftParticles: { enabled: false },
      },
      stars: { outer: { count }, core: { enabled: false } },
    },
  });
  const pp = new ParticlePool(10000);
  let burst = null;
  const ctx = {
    pp,
    sh: {},
    audible: false,
    lights: {
      newLight() {},
      setHemi() {
        burst = true;
      },
    },
  };
  effectFire(ctx, design, { x: 0, y: 100, z: 0 }, { rng: createSeededRng(123), audible: false });
  const carrier = pp.particles[pp.aliveIndices[0]];
  const trajectory = [];
  for (let frame = 0; frame < 600 && carrier.alive; frame++) {
    assert.equal(carrier.size, size, 'shell size stays constant until the burst');
    trajectory.push([carrier.x, carrier.y, carrier.z, carrier.vx, carrier.vy, carrier.vz]);
    carrier.update(1 / 60, frame / 60);
    if (burst) break;
  }
  assert.equal(burst, true, 'even the smallest shell survives to detonation');
  return { design, trajectory };
}

test('star count and distribution do not change launch speed, trajectory or shell size', () => {
  const baseline = launch();
  assert.equal(baseline.design.liftVelocity, DEFAULT_LIFT_VELOCITY);
  for (const count of [1, 200]) {
    for (const pattern of ['fibonacci', 'wave', 'strobe']) {
      for (const size of [1, 27.5, 1000]) {
        assert.deepEqual(launch({ count, pattern, size }).trajectory, baseline.trajectory);
      }
    }
  }
  assert.ok(launch({ speed: 40, size: 1 }).trajectory.length > baseline.trajectory.length);
});

test('guided shells use the authored size without a hidden minimum, maximum or decay', () => {
  for (const size of [1, 27.5, 110, 500, 1000]) {
    const design = compileFireworkDesign({ variantOverrides: { launch: { shell: { size } } } });
    const pp = new ParticlePool(10);
    effectSpawnGuidedLaunchShell(
      { pp },
      { x: 0, y: 100, z: 0 },
      design,
      new THREE.Color(1, 1, 1),
      size,
      1 / 60,
    );
    const particle = pp.particles[pp.aliveIndices[0]];
    assert.equal(particle.size, size);
    particle.update(1 / 60, 0);
    assert.equal(particle.size, size);
    assert.equal(particle.alive, true);
  }
});
