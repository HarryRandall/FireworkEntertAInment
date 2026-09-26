import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compileFireworkDesign, validateFireworkDesign } from '../src/design.ts';
import { Scheduler } from '../src/Scheduler.ts';
import { Effects } from '../src/Effects.ts';
import { ParticlePool } from '../src/ParticlePool.ts';
import { createSeededRng } from '../src/random.ts';
import { RENDERER_BEHAVIOURS } from '../src/behaviours.ts';
import { FIREWORK_EFFECT_CATALOGUE, catalogueEffectModelJson } from '../src/effect-catalogue.ts';

test('invalid saved values produce field diagnostics, never a default firework', () => {
  for (const value of [
    { geometry: 'unknown' },
    { stars: { outer: { count: -1 } } },
    { stars: { core: { burstTrail: { stops: 'wrong' } } } },
    [],
  ]) {
    const result = validateFireworkDesign({ variantOverrides: value });
    assert.equal(result.ok, false);
    assert.ok(result.diagnostics.length);
    assert.equal('design' in result, false);
  }
  const result = validateFireworkDesign({
    variantOverrides: { stars: { outer: { head: { glowStrength: -1 } } } },
  });
  assert.deepEqual(result.diagnostics[0].path, ['stars', 'outer', 'head', 'glowStrength']);
});

test('every catalogue composition uses a registered behaviour and round-trips', () => {
  for (const effect of FIREWORK_EFFECT_CATALOGUE) {
    const design = compileFireworkDesign({ baseModel: catalogueEffectModelJson(effect) });
    assert.ok(RENDERER_BEHAVIOURS[design.geometry], effect.slug);
    assert.deepEqual(
      compileFireworkDesign({ variantOverrides: JSON.parse(JSON.stringify(design)) }),
      design,
    );
  }
});

test('disabled layers and launch emitters leave no substitute particles', () => {
  const pool = new ParticlePool(10000);
  const effects = new Effects(pool, {}, { newLight() {}, setHemi() {} });
  const design = compileFireworkDesign({
    variantOverrides: {
      liftVelocity: 4,
      launch: {
        shell: { visible: false },
        liftParticles: { enabled: false },
        smoke: { enabled: false },
      },
      stars: { outer: { enabled: false }, core: { enabled: false } },
      crackle: { enabled: false },
      split: { enabled: false },
    },
  });
  effects.fire(design, { x: 0, y: 0, z: 0 }, { rng: createSeededRng(123), audible: false });
  for (let frame = 0; frame < 180; frame++) {
    for (let slot = 0; slot < pool.aliveCount; slot++)
      pool.particles[pool.aliveIndices[slot]].update(1 / 60, frame / 60);
    pool.compactAliveMax();
  }
  assert.equal(pool.aliveCount, 0);
});

test('invalid cue skipping preserves subsequent cue times and seek boundaries', () => {
  const scheduler = new Scheduler();
  const cue = (id, time, design) => ({
    id,
    timeSeconds: time,
    launchPositionIndex: 0,
    firework: { id, caliber: null, durationSeconds: 5, renderDesign: design },
  });
  scheduler.setCues([cue('bad', 2, null), cue('valid', 7, compileFireworkDesign({}))]);
  assert.deepEqual(
    scheduler.pop(0, 3).filter((c) => c.firework.renderDesign),
    [],
  );
  assert.deepEqual(
    scheduler.pop(3, 7).map((c) => [c.id, c.timeSeconds]),
    [['valid', 7]],
  );
  scheduler.resetAll();
  assert.equal(scheduler.pop(7, 7)[0].id, 'valid');
});
