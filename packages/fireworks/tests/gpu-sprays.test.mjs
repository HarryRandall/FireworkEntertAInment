/** Texture capacity, integer packing and resource lifetimes without a WebGL context. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { SprayBirths } from '../src/view/spray-births.ts';
import { GpuSprays } from '../src/view/gpu-sprays.ts';
import { SOURCE_TEXTURE_WIDTH } from '../src/view/source-layout.ts';

const options = {
  count: 20,
  life: 1,
  spread: 2,
  size: 1,
  flicker: 0.6,
  colour: [1, 0.5, 0.2],
  seed: 2147483647,
  fork: 1,
  streak: 16,
};
const slot = { id: -1, age: 0.2, life: 1, emissionTime: 0 };
function joinWord(data, low, high) {
  return data[low] | (data[high] << 16);
}

test('sampled reference birth packing retains signed hash words and copies reused tuples', () => {
  const births = new SprayBirths();
  const origin = [3, 10, -4];
  const velocity = [1, 2, 3];
  births.receive(slot, origin, velocity, 0.8, 0.2, options);
  origin[0] = 999;
  velocity[0] = 999;
  assert.equal(births.data[0], 3);
  assert.equal(births.data[4], 1);
  assert.equal(joinWord(births.data, 8, 32), slot.id);
  assert.equal(joinWord(births.data, 9, 33), options.seed);
  const tick = Math.floor((0.2 + slot.id * 0.013) * 28);
  assert.equal(joinWord(births.data, 27, 34), tick);
});

test('analytic source uploads refresh local clocks, grow safely and release GPU resources', () => {
  const layer = new GpuSprays({ uScale: { value: 1 }, uDpr: { value: 1 } });
  assert.equal(layer.points.geometry.getAttribute('position'), undefined);
  assert.equal(layer.points.geometry.boundingSphere.radius, 0);
  assert.ok(layer.points.geometry.boundingSphere.center.toArray().every(Number.isFinite));
  assert.equal(layer.points.frustumCulled, false);
  const origin = [3, 10, -4];
  layer.sources.reset(0.2);
  layer.sources.receive({ kind: 'fixed', origin }, 0, 1, 0.2, options);
  origin[0] = 999;
  assert.equal(layer.sources.data[40], 3);
  assert.equal(joinWord(layer.sources.data, 8, 9), options.seed);
  layer.upload();
  const texture = layer.points.material.uniforms.uSources.value;
  const positions = layer.points.geometry.getAttribute('position');
  assert.equal(texture.image.width, SOURCE_TEXTURE_WIDTH);
  assert.equal(texture.image.height * SOURCE_TEXTURE_WIDTH * 4, layer.sources.data.length);
  assert.equal(layer.points.geometry.drawRange.count, layer.sources.count);
  const version = texture.version;
  layer.sources.reset(0.5);
  layer.sources.receive({ kind: 'fixed', origin: [3, 10, -4] }, 0, 1, 0.5, options);
  assert.equal(layer.sources.dirty, true, 'Advancing time refreshes the reduced source clock');
  layer.upload();
  assert.equal(texture.version, version + 1);
  assert.equal(layer.points.geometry.getAttribute('position'), positions);
  assert.equal(layer.points.material.uniforms.uSourceTime.value, 0.5);
  let textureDisposals = 0;
  texture.addEventListener('dispose', () => textureDisposals++);
  for (let index = 0; index < 100; index++)
    layer.sources.receive({ kind: 'fixed', origin }, 0, 1, 0.5, options);
  layer.upload();
  assert.equal(textureDisposals, 1);
  layer.sources.reset(0);
  layer.upload();
  assert.equal(layer.points.geometry.drawRange.count, 0);
  let finalDisposals = 0;
  layer.points.material.uniforms.uSources.value.addEventListener('dispose', () => finalDisposals++);
  layer.dispose();
  assert.equal(finalDisposals, 1);
});

test('candidate budget is bounded and reset allows direct seek replay', () => {
  const births = new SprayBirths();
  for (let index = 0; index < 10000; index++)
    births.receive(slot, [0, 0, 0], [0, 0, 0], 1, 0.2, options);
  assert.equal(births.count, 140000);
  assert.ok(births.births <= 140000);
  births.reset();
  births.receive(slot, [0, 0, 0], [0, 0, 0], 1, 0.2, options);
  assert.equal(births.count, 17);
  assert.deepEqual([...births.indices.slice(0, 4)], [0, 0, 0, 1]);
});
