/** Prototype parity, source-clock determinism and bounded spray/smoke output. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  simulate,
  upgradeDesign,
  ParticleKind,
  spraySlots,
  sparkState,
  hash,
} from '../src/index.ts';
import { spray } from '../src/sim/spray.ts';
import { ParticleWriter } from '../src/sim/particles.ts';
import { sprayCases } from './spray-cases.mjs';
import { modifier } from './kind-cases.mjs';
const golden = JSON.parse(readFileSync(new URL('./fixtures/core-goldens.json', import.meta.url)));
const row = (p, i) => [
  p.kinds[i],
  ...p.positions.slice(i * 3, i * 3 + 3),
  ...p.colours.slice(i * 3, i * 3 + 3),
  p.sizes[i],
  p.alphas[i],
];
const smokeRow = (p, i) => [
  ...p.positions.slice(i * 3, i * 3 + 3),
  ...p.colours.slice(i * 3, i * 3 + 3),
  p.sizes[i],
  p.alphas[i],
  p.seeds[i],
  p.ages[i],
];
const close = (actual, expected, label) =>
  actual.forEach((v, i) =>
    assert.ok(Math.abs(v - expected[i]) <= 1e-6, `${label} field=${i}: ${v} != ${expected[i]}`),
  );
for (const c of sprayCases()) {
  test(`${c.name}: full spray and smoke frame matches independent reference`, () => {
    const d = upgradeDesign(c.design, 1),
      frames = golden.sprays.find((g) => g.name === c.name).frames;
    for (const f of frames) {
      const p = simulate(d, f.time_s);
      assert.equal(p.kinds.length, f.count, `${c.name} t=${f.time_s}`);
      for (const s of f.samples)
        close(row(p, s.index), s.values, `${c.name} t=${f.time_s} row=${s.index}`);
      assert.equal(p.smoke.sizes.length, f.smoke.count, `${c.name} t=${f.time_s} smoke`);
      for (const s of f.smoke.samples)
        close(smokeRow(p.smoke, s.index), s.values, `${c.name} t=${f.time_s} smoke=${s.index}`);
    }
  });
  test(`${c.name}: full output is deterministic across forward and backward seeks`, () => {
    const d = upgradeDesign(c.design, 1),
      before = structuredClone(d),
      t = c.times[1];
    const opts = { position: [7, -3], muzzle_m: 2.5, seed: 42 };
    const direct = simulate(d, t, opts);
    simulate(d, 0, opts);
    simulate(d, 8, opts);
    simulate(d, 0.1, opts);
    assert.deepEqual(simulate(d, t, opts), direct);
    assert.deepEqual(d, before);
    const saved = structuredClone(direct);
    simulate(d, t + 0.1, opts);
    assert.deepEqual(direct, saved);
  });
}
const options = {
  count: 60,
  life: 0.8,
  spread: 3,
  size: 1,
  flicker: 0.3,
  colour: [1, 0.4, 0.1],
  seed: 11,
  inherit: 0,
};
test('slot identity and birth times survive scrub-window changes', () => {
  const a = spraySlots(0.35, 2, 0.9, options),
    b = spraySlots(0.35, 2, 1, options);
  const shared = a.filter((s) => b.some((t) => t.id === s.id));
  assert.ok(shared.length > 0);
  for (const s of shared) {
    const later = b.find((t) => t.id === s.id);
    assert.equal(later.emissionTime, s.emissionTime);
    assert.equal(later.life, s.life);
  }
  assert.deepEqual(spraySlots(0, 1, 1, { ...options, count: 0 }), []);
  assert.deepEqual(spraySlots(0, 1, -1, options), []);
});
test('birth alpha is frozen, and endpoint inheritance uses a backward difference', () => {
  const build = (o) => {
    const writer = new ParticleWriter();
    spray(writer, (t) => [10 * Math.min(t, 0.3), 4, 0], 0, 0.3, 0.31, o);
    return writer.finish();
  };
  const a = build({ ...options, inherit: 1, alphaAt: () => 0.5 });
  const b = build({ ...options, inherit: 1, alpha: 0.5 });
  assert.deepEqual(a, b);
  const noInherit = build({ ...options, alpha: 0.5 });
  assert.equal(a.kinds.length, noInherit.kinds.length);
  const latest = spraySlots(0, 0.3, 0.31, options)[0];
  assert.ok(latest.emissionTime + 0.016 > 0.3);
  const expectedOffset = (10 * (1 - Math.exp(-2.5 * latest.age))) / 2.5;
  assert.ok(Math.abs(a.positions[0] - noInherit.positions[0] - expectedOffset) < 1e-6);
  assert.equal(build({ ...options, alphaAt: () => 0 }).kinds.length, 0);
});
test('fixed-size kernel writes forks, delayed glitter and bounded streaks into supplied storage', () => {
  const out = new Float64Array(17 * 8);
  const kernel = (o, age) => sparkState(5, age, 1, age, 0, 2, 0, 0, 0, 0, 1, o, out);
  assert.equal(kernel({ ...options, streak: 16 }, 0.3), 17);
  assert.equal(kernel({ ...options, fork: 1 }, 0.7), 0);
  const fa = 0.25 + 0.4 * hash(5, 11, 5);
  assert.equal(kernel({ ...options, fork: 1 }, fa + 0.03), 4);
  assert.equal(kernel({ ...options, glitter: 1, glitterDelay: 0.2 }, 0.001), 1);
  const delay = Math.min(0.9, 0.2 * (0.45 + 1.1 * hash(5, 11, 6)));
  kernel({ ...options, glitter: 1, glitterDelay: 0.2 }, delay + 0.01);
  assert.ok(out[7] > 1);
  assert.equal(kernel({ ...options, glitter: 1, glitterDelay: 0.2 }, delay + 0.08), 0);
});

// Budgets include fork children and streak points, not just emission slots.
for (const [name, budget] of [
  ['kind-shell', 3000],
  ['kind-comet', 400],
  ['kind-fountain', 7000],
  ['kind-wheel', 2000],
  ['kind-spinner', 500],
  ['kind-tourbillon', 650],
  ['fountain-line', 13000],
])
  test(`${name}: fixed-time live sparks stay within the stated ${budget} point budget`, () => {
    const c = sprayCases().find((c) => c.name === name);
    let peak = 0;
    for (const t of c.times) {
      const p = simulate(c.design, t);
      const count = p.kinds.filter((k) => k === ParticleKind.Spark).length;
      assert.ok(count <= budget, `t=${t}: ${count} > ${budget}`);
      peak = Math.max(peak, count);
    }
    assert.ok(peak > 0);
  });
test('glitter composes with motion while leaving heads intact', () => {
  const d = sprayCases().find((c) => c.name === 'kind-shell').design;
  const l = d.breaks[0].layers[0];
  const heads = (p) =>
    Array.from(p.kinds.keys())
      .filter((i) => p.kinds[i] !== ParticleKind.Spark)
      .map((i) => row(p, i));
  const t = d.launch.time_s + 1.3;
  const base = simulate(d, t);
  l.modifiers = [{ ...modifier('fish'), at: 0.1 }];
  const fish = simulate(d, t);
  l.modifiers.push({ ...modifier('glitter'), amount: 1, at: 0.3 });
  const both = simulate(d, t);
  assert.notDeepEqual(heads(fish), heads(base));
  assert.deepEqual(heads(both), heads(fish));
  assert.notDeepEqual(both.positions, fish.positions);
});
test('smoke can be skipped, drifts with wind, preserves placement and respects the puff cap', () => {
  const d = sprayCases().find((c) => c.name === 'kind-shell').design;
  const t = 0.53;
  const p = simulate(d, t),
    disabled = simulate(d, t, { smoke: false });
  assert.ok(p.smoke.sizes.length > 0);
  assert.equal(disabled.smoke.sizes.length, 0);
  assert.deepEqual(disabled.positions, p.positions);
  const translated = simulate(d, t, { position: [7, -3] });
  for (let i = 0; i < p.smoke.sizes.length; i++) {
    assert.ok(Math.abs(translated.smoke.positions[i * 3] - p.smoke.positions[i * 3] - 7) < 1e-5);
    assert.ok(
      Math.abs(translated.smoke.positions[i * 3 + 2] - p.smoke.positions[i * 3 + 2] + 3) < 1e-5,
    );
    assert.ok(p.smoke.positions[i * 3 + 1] >= p.smoke.sizes[i] * 0.5 - 1e-6);
  }
  const w = new ParticleWriter();
  for (let i = 0; i < 6001; i++) w.smoke(0, 0, 0, [0.01, 0.01, 0.01], 2, 0.1, i, 0.5);
  const smoke = w.finish().smoke;
  assert.equal(smoke.sizes.length, 6000);
  assert.equal(smoke.positions[1], 1);
  assert.equal(simulate(d, -1).smoke.sizes.length, 0);
  d.launch.smoke = 0;
  assert.equal(simulate(d, 3).smoke.sizes.length, 0);
});
