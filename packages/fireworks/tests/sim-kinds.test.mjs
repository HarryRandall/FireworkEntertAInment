/** Golden and behavioural tests for ground kinds and layer modifiers. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  simulate,
  upgradeDesign,
  resolveDesign,
  shotDuration,
  ParticleKind,
  directions,
} from '../src/index.ts';
import { kindCases, modifier } from './kind-cases.mjs';
const golden = JSON.parse(readFileSync(new URL('./fixtures/core-goldens.json', import.meta.url)));
const row = (p, i) => [
  p.kinds[i],
  ...p.positions.slice(i * 3, i * 3 + 3),
  ...p.colours.slice(i * 3, i * 3 + 3),
  p.sizes[i],
  p.alphas[i],
];
for (const c of golden.kinds) {
  test(`${c.name}: heads and discrete particles match the independent prototype capture`, () => {
    const d = upgradeDesign(kindCases().find((input) => input.name === c.name).design, 1);
    for (const f of c.frames) {
      const p = simulate(d, f.time_s);
      assert.equal(p.kinds.length, f.count, `${c.name} t=${f.time_s}`);
      for (const s of f.samples)
        row(p, s.index).forEach((v, i) =>
          assert.ok(
            Math.abs(v - s.values[i]) <= 1e-6,
            `${c.name} t=${f.time_s} row=${s.index} field=${i}: ${v} != ${s.values[i]}`,
          ),
        );
    }
  });
}
for (const c of kindCases()) {
  test(`${c.name}: exact scrub determinism, placement, seed and adjustment resolution`, () => {
    const d = upgradeDesign(c.design, 1),
      original = structuredClone(d);
    const options = { position: [7, -3], muzzle_m: 2.5, seed: 42 },
      t = c.times[1];
    const p = simulate(d, t, options);
    simulate(d, 0.1, options);
    simulate(d, 8, options);
    assert.deepEqual(simulate(d, t, options), p);
    assert.deepEqual(d, original);
    assert.equal(simulate(d, -0.1).kinds.length, 0);
    assert.throws(() => simulate(d, Infinity), /finite/);
    const origin = simulate(d, t, { seed: 42, muzzle_m: 2.5 });
    assert.deepEqual(p.kinds, origin.kinds);
    for (let i = 0; i < p.kinds.length; i++) {
      assert.ok(Math.abs(p.positions[i * 3] - origin.positions[i * 3] - 7) < 1e-5);
      assert.ok(Math.abs(p.positions[i * 3 + 2] - origin.positions[i * 3 + 2] + 3) < 1e-5);
    }
    const adjusted = structuredClone(d);
    adjusted.adjustments = d.launch
      ? { 'launch.height': 1 }
      : d.kind === 'comet' || d.kind === 'candle' || d.kind === 'tourbillon'
        ? { 'ground.height': 1 }
        : d.kind === 'fountain'
          ? { 'ground.duration': 1 }
          : {};
    assert.deepEqual(simulate(adjusted, t, options), simulate(resolveDesign(adjusted), t, options));
    assert.equal(simulate(d, shotDuration(d) + 5).kinds.length, 0);
  });
}
test('fish and twinkle both affect a layer, with motion and brightness composed independently', () => {
  const d = kindCases().find((c) => c.name === 'kind-shell').design,
    layer = d.breaks[0].layers[0],
    t = d.launch.time_s + 1.3;
  const base = simulate(d, t);
  layer.modifiers = [{ ...modifier('fish'), at: 0.1 }];
  const fish = simulate(d, t);
  layer.modifiers = [{ ...modifier('twinkle'), at: 0.1 }];
  const twinkle = simulate(d, t);
  layer.modifiers.push({ ...modifier('fish'), at: 0.1 });
  const both = simulate(d, t);
  assert.notDeepEqual(fish.positions, base.positions);
  assert.notDeepEqual(twinkle.alphas, base.alphas);
  assert.deepEqual(both.positions, fish.positions);
  assert.deepEqual(both.alphas, twinkle.alphas);
});
test('split and pop events outlive parents and combine on one layer', () => {
  const d = kindCases().find((c) => c.name === 'kind-shell').design,
    l = d.breaks[0].layers[0];
  d.breaks[0].core.enabled = false;
  l.count = 1;
  l.life_var = 0;
  l.modifiers = [{ ...modifier('split'), at: 0.95 }, modifier('pop')];
  const time = d.launch.time_s + l.life_s + 0.1;
  const p = simulate(d, time);
  assert.ok([...p.kinds].includes(ParticleKind.Head));
  assert.ok([...p.kinds].includes(ParticleKind.Spark));
  l.head.visible = false;
  assert.ok(simulate(d, time).kinds.length > 0);
});
test('planar shapes face the camera; palm and horsetail use their stored sphere/bottom patterns', () => {
  assert.ok(directions(32, 'heart', 11).every((q) => q.z === 0));
  assert.ok(directions(32, 'random', 11).every((q) => q.y > 0));
  assert.ok(directions(32, 'bottom', 11).every((q) => q.y < 0.25));
  assert.notDeepEqual(directions(32, 'ring', 11, 0), directions(32, 'ring', 11, 0.8));
});

test('glitter supplies delayed spray controls without adding independent head particles', async () => {
  const { trailControls } = await import('../src/sim/modifiers.ts');
  const d = kindCases().find((c) => c.name === 'kind-shell').design,
    l = d.breaks[0].layers[0];
  const baseline = simulate(d, 3);
  l.modifiers = [{ ...modifier('glitter'), at: 0.4, amount: 0.7 }];
  assert.deepEqual(trailControls(l), { glitter: 0.7, glitter_delay_s: 0.4 * l.life_s });
  assert.deepEqual(simulate(d, 3), baseline);
  l.modifiers[0].amount = 20;
  assert.equal(trailControls(l).glitter, 1);
  l.modifiers[0].amount = -20;
  assert.equal(trailControls(l).glitter, 0);
});
