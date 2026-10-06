/** Authored brightness is sampled at each star's normalised age, rather than using its peak. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { effectTemplates, simulate, ParticleKind, brightnessAt } from '../src/index.ts';

const source = effectTemplates.find((item) => item.key === 'peony').design;
function controlled(curve) {
  const design = structuredClone(source);
  design.breaks = [design.breaks[0]];
  const burst = design.breaks[0];
  burst.core.enabled = false;
  burst.layers = [burst.layers[0]];
  const layer = burst.layers[0];
  layer.life_var = 0;
  layer.modifiers = [];
  layer.trail.sparks = 0;
  layer.brightness = curve;
  return design;
}
test('equal-peak curves change per-star alpha over life and leave motion deterministic', () => {
  const flat = controlled([
    [0, 1],
    [1, 1],
  ]);
  const shaped = controlled([
    [0, 0.2],
    [0.5, 1],
    [1, 0.2],
  ]);
  const layer = shaped.breaks[0].layers[0];
  const before = structuredClone(shaped);
  for (const progress of [0.25, 0.5, 0.75]) {
    const time =
      shaped.launch.time_s + shaped.breaks[0].at_s + layer.delay_s + progress * layer.life_s;
    const options = { sprays: false, smoke: false, launchEffects: false };
    const base = simulate(flat, time, options);
    const result = simulate(shaped, time, options);
    const heads = Array.from(result.kinds.keys()).filter(
      (index) => result.kinds[index] === ParticleKind.Head,
    );
    assert.ok(heads.length > 0);
    for (const index of heads) {
      const expected = base.alphas[index] * brightnessAt(layer.brightness, progress);
      assert.ok(Math.abs(result.alphas[index] - expected) < 1e-6);
    }
    assert.deepEqual(result.positions, base.positions);
    assert.deepEqual(result, simulate(shaped, time, options));
  }
  assert.deepEqual(shaped, before);
});
