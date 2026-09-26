import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { Lights } from '../src/Lights.ts';
import { compileFireworkDesign, scaleDesignForEmphasis } from '../src/design.ts';
import { effectDetonate } from '../src/effects/burst.ts';
import { createShellEffectBudget } from '../src/effects/math.ts';
import { ParticlePool } from '../src/ParticlePool.ts';
import { createSeededRng } from '../src/random.ts';

test('scene flash is independent of density and zero leaves other flashes alone', () => {
  for (const count of [1, 100, 200]) {
    for (const intensity of [0, 0.1, 4]) {
      const calls = [];
      const design = compileFireworkDesign({
        variantOverrides: {
          burstFlashIntensity: intensity,
          stars: { outer: { count }, core: { enabled: false } },
        },
      });
      effectDetonate(
        {
          pp: new ParticlePool(1000),
          sh: {},
          lights: {
            setHemi(...args) {
              calls.push(args);
            },
          },
        },
        { x: 0, y: 100, z: 0 },
        0,
        0,
        design,
        new THREE.Color(1, 0, 0),
        1,
        createSeededRng(321),
        false,
        createShellEffectBudget(),
      );
      assert.deepEqual(calls, intensity === 0 ? [] : [[intensity, 1, 0, 0]]);
      assert.equal(Object.hasOwn(design, 'size'), false);
    }
  }
  const design = compileFireworkDesign({ variantOverrides: { burstFlashIntensity: 0 } });
  assert.equal(scaleDesignForEmphasis(design, 'peak').burstFlashIntensity, 0);
});

test('lights fade by elapsed time and never darken the ambient scene', () => {
  function simulate(dt, frames) {
    const scene = new THREE.Scene();
    const lights = new Lights(scene);
    lights.setHemi(2, 1, 0, 0);
    lights.newLight({ x: 0, y: 0, z: 0 }, new THREE.Color(1, 1, 1), 12);
    for (let frame = 0; frame < frames; frame++) lights.update(dt);
    return { lights, scene };
  }
  const slow = simulate(1 / 30, 3);
  const fast = simulate(1 / 120, 12);
  assert.ok(Math.abs(slow.lights.hemi.intensity - fast.lights.hemi.intensity) < 1e-9);
  const point = ({ scene }) => scene.children.find((child) => child instanceof THREE.PointLight);
  assert.ok(Math.abs(point(slow).intensity - point(fast).intensity) < 1e-9);
  const baseline = new Lights(new THREE.Scene());
  slow.lights.setHemi(0.01, 1, 0, 0);
  assert.ok(slow.lights.hemi.intensity > baseline.hemi.intensity);
  slow.lights.update(1);
  assert.equal(slow.lights.hemi.intensity, baseline.hemi.intensity);
  assert.equal(point(slow).intensity, 0);
  slow.lights.setHemi(2, 0, 1, 0);
  const active = slow.lights.hemi.intensity;
  slow.lights.setHemi(0, 1, 0, 0);
  assert.equal(slow.lights.hemi.intensity, active);
  assert.equal(slow.lights.hemi.color.g, 1);
});
