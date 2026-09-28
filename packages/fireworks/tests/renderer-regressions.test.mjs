import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { Effects } from '../src/Effects.ts';
import { ParticlePool } from '../src/ParticlePool.ts';
import { Scheduler } from '../src/Scheduler.ts';
import { compileFireworkDesign, scaleDesignForEmphasis } from '../src/design.ts';
import { FIREWORK_EFFECT_CATALOGUE, catalogueEffectModelJson } from '../src/effect-catalogue.ts';
import { parseCaliberMm } from '../src/model/scaling.ts';
import { createSeededRng } from '../src/random.ts';

const noLights = { newLight() {}, setHemi() {} };

function catalogueDesign(effect) {
  return compileFireworkDesign({
    baseModel: catalogueEffectModelJson(effect),
    primaryColor: effect.previewPalette[0],
  });
}

function simulate(design, { audible = false, sound = {}, frames = 600 } = {}) {
  const pool = new ParticlePool(100_000);
  let starsSpawned = 0;
  const spawn = pool.new.bind(pool);
  pool.new = (properties) => {
    // Burst stars are the only particles spawned with this mass.
    if (properties.mass === 0.0005) starsSpawned += 1;
    return spawn(properties);
  };
  const effects = new Effects(pool, sound, noLights);
  effects.setAudible(audible);
  effects.fire(design, { x: 0, y: 0, z: 0 }, { rng: createSeededRng(7), audible });
  const hash = createHash('sha256');
  let peak = 0;
  for (let frame = 0; frame < frames; frame++) {
    for (let slot = 0; slot < pool.aliveCount; slot++) {
      pool.particles[pool.aliveIndices[slot]].update(1 / 60, frame / 60);
    }
    pool.compactAliveMax();
    peak = Math.max(peak, pool.aliveCount);
    if (frame % 20 === 0) {
      for (let slot = 0; slot < pool.aliveCount; slot++) {
        const p = pool.particles[pool.aliveIndices[slot]];
        hash.update(`${p.x},${p.y},${p.z},${p.size},${p.color.r};`);
      }
    }
  }
  return { hash: hash.digest('hex'), peak, starsSpawned };
}

test('sound playback never changes what a firework looks like', () => {
  // A sound stub drawing unrelated randomness stands in for real audio.
  const sound = {
    chance: (probability) => Math.random() < probability,
    playRandomMortar() {},
    playRandomLightBoom() {},
    playRandomHeavyBoom() {},
    playRandomCrackle() {},
  };
  for (const effect of FIREWORK_EFFECT_CATALOGUE) {
    const design = catalogueDesign(effect);
    assert.equal(
      simulate(design, { audible: true, sound }).hash,
      simulate(design, { audible: false }).hash,
      `${effect.slug} differs when audible`,
    );
  }
});

test('a short-fused shell bursts at every emphasis instead of expiring', () => {
  // Imported products often carry tight fuses: 22 m/s lift with a 2.6 s fuse
  // reaches its apex at normal emphasis but not at 1.5x peak lift.
  const ring = FIREWORK_EFFECT_CATALOGUE.find((effect) => effect.slug === 'ring');
  const design = compileFireworkDesign({
    baseModel: catalogueEffectModelJson(ring),
    primaryColor: ring.previewPalette[0],
    variantOverrides: { liftVelocity: 22, shellLife: 2.6 },
  });
  assert.equal(design.shellLife, 2.6);
  assert.equal(design.liftVelocity, 22);
  const normal = simulate(design).starsSpawned;
  assert.ok(normal > 0, 'normal emphasis never burst');
  for (const emphasis of ['accent', 'peak']) {
    const stars = simulate(scaleDesignForEmphasis(design, emphasis), { frames: 900 }).starsSpawned;
    assert.ok(stars >= normal, `${emphasis}: ${stars} stars < ${normal}`);
  }
});

test('restoring a snapshot never re-fires a cue at the snapshot time', () => {
  const cue = (id, timeSeconds) => ({ id, timeSeconds });
  const scheduler = new Scheduler();
  scheduler.setCues([cue('a', 1), cue('b', 2), cue('c', 3)]);
  assert.deepEqual(
    scheduler.pop(0, 2).map((c) => c.id),
    ['a', 'b'],
  );
  scheduler.resetFiredAfter(2);
  assert.deepEqual(scheduler.pop(2, 2), []);
  assert.deepEqual(
    scheduler.pop(2, 3).map((c) => c.id),
    ['c'],
  );
  scheduler.resetFiredAfter(1);
  assert.deepEqual(
    scheduler.pop(1, 3).map((c) => c.id),
    ['b', 'c'],
  );
});

test('calibres accept millimetres and every common inch notation', () => {
  assert.equal(parseCaliberMm('30mm'), 30);
  for (const value of ['3"', '3”', '3″', '3 in', '3 inch']) {
    assert.ok(Math.abs(parseCaliberMm(value) - 76.2) < 1e-9, value);
  }
  assert.equal(parseCaliberMm('large'), null);
});
