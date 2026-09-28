import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  compileFireworkDesign,
  scaleDesignForCaliber,
  scaleDesignForEmphasis,
} from '../src/design.ts';
import { effectFire } from '../src/effects/launch.ts';
import { previewShellRiseHeight } from '../src/effects/lift.ts';
import { ParticlePool } from '../src/ParticlePool.ts';
import { createSeededRng } from '../src/random.ts';

function launch(design, compactPreview) {
  const pp = new ParticlePool(10000);
  let frame = 0;
  const stars = [];
  const visibleLaunch = [];
  const spawn = pp.new.bind(pp);
  pp.new = (properties) => {
    if (properties.mass === 0.0005) stars.push({ frame, ...properties });
    if (properties.mass === 0.5 && properties.gravity === 0) visibleLaunch.push(properties.y);
    return spawn(properties);
  };
  const ctx = { pp, sh: {}, audible: false, lights: { newLight() {}, setHemi() {} } };
  effectFire(
    ctx,
    design,
    { x: 0, y: 0, z: 0 },
    {
      rng: createSeededRng(123),
      audible: false,
      compactPreview,
    },
  );
  const carrier = pp.particles[pp.aliveIndices[0]];
  for (; frame < 3600 && carrier.alive; frame++) carrier.update(1 / 60, frame / 60);
  return { stars, visibleLaunch };
}

const design = compileFireworkDesign({
  variantOverrides: {
    launch: { smoke: { enabled: false }, liftParticles: { enabled: false } },
    stars: { outer: { count: 20 }, core: { enabled: false } },
  },
});

test('preview heights retain ordering, leave low effects alone and approach a bounded ceiling', () => {
  assert.equal(previewShellRiseHeight(300), 300);
  assert.equal(previewShellRiseHeight(700), 700);
  const heights = [1000, 2000, 5000, 20000].map(previewShellRiseHeight);
  for (let i = 0; i < heights.length; i++) {
    assert.ok(heights[i] <= 1200);
    assert.ok(heights[i] > (heights[i - 1] ?? 700));
  }
});

test('compact previews lower tall launches without changing burst time, star count or shape', () => {
  for (const caliber of ['30mm', '100mm', '150mm']) {
    for (const emphasis of ['normal', 'accent', 'peak']) {
      const authored = scaleDesignForEmphasis(scaleDesignForCaliber(design, caliber), emphasis);
      const before = JSON.stringify(authored);
      const original = launch(authored, false);
      const preview = launch(authored, true);
      assert.ok(original.stars.length > 0);
      assert.equal(preview.stars.length, original.stars.length);
      assert.equal(preview.stars[0].frame, original.stars[0].frame);
      const offset = original.stars[0].y - preview.stars[0].y;
      assert.ok(offset >= 0);
      assert.ok(preview.stars[0].y <= 1200);
      for (let i = 0; i < preview.stars.length; i++) {
        const a = original.stars[i];
        const b = preview.stars[i];
        assert.ok(Math.abs(a.y - b.y - offset) < 1e-8);
        for (const key of ['x', 'z', 'vx', 'vy', 'vz', 'life', 'size', 'r', 'g', 'b']) {
          assert.equal(b[key], a[key], `${caliber}/${emphasis}: ${key}`);
        }
      }
      assert.ok(preview.visibleLaunch.every((y) => y <= 1200));
      assert.equal(JSON.stringify(authored), before);
    }
  }
});

test('short fuses keep their burst time and invisible launch shells stay invisible', () => {
  const short = {
    ...design,
    liftVelocity: 60,
    shellLife: 0.8,
    launch: { ...design.launch, shell: { ...design.launch.shell, visible: false } },
  };
  const original = launch(short, false);
  const preview = launch(short, true);
  assert.equal(preview.stars[0].frame, original.stars[0].frame);
  assert.ok(preview.stars[0].y < original.stars[0].y);
  assert.deepEqual(preview.visibleLaunch, []);
});
