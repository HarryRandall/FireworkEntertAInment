/** Texture capacity, integer packing and resource lifetimes without a WebGL context. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { SprayBirths, BIRTH_TEXTURE_WIDTH } from '../src/view/spray-births.ts';
import { GpuSprays } from '../src/view/gpu-sprays.ts';

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

test('birth upload retains signed hash words, copies reused tuples and reuses capacity', () => {
  const layer = new GpuSprays({ uScale: { value: 1 }, uDpr: { value: 1 } });
  assert.equal(layer.points.geometry.getAttribute('position'), undefined);
  assert.equal(layer.points.geometry.boundingSphere.radius, 0);
  assert.ok(layer.points.geometry.boundingSphere.center.toArray().every(Number.isFinite));
  assert.equal(layer.points.frustumCulled, false);
  const origin = [3, 10, -4];
  const velocity = [1, 2, 3];
  layer.births.receive(slot, origin, velocity, 0.8, 0.2, options);
  origin[0] = 999;
  velocity[0] = 999;
  assert.equal(layer.births.data[0], 3);
  assert.equal(layer.births.data[4], 1);
  assert.equal(joinWord(layer.births.data, 8, 32), slot.id);
  assert.equal(joinWord(layer.births.data, 9, 33), options.seed);
  const tick = Math.floor((0.2 + slot.id * 0.013) * 28);
  assert.equal(joinWord(layer.births.data, 27, 34), tick);
  layer.upload();
  const texture = layer.points.material.uniforms.uBirths.value;
  assert.equal(texture.image.width, BIRTH_TEXTURE_WIDTH);
  assert.equal(texture.image.height * BIRTH_TEXTURE_WIDTH * 4, layer.births.data.length);
  layer.upload();
  assert.equal(layer.points.material.uniforms.uBirths.value, texture);
  assert.equal(layer.points.geometry.drawRange.count, 17);
  let textureDisposals = 0;
  texture.addEventListener('dispose', () => textureDisposals++);
  for (let index = 0; index < 1200; index++)
    layer.births.receive(slot, origin, velocity, 1, 0.2, options);
  layer.upload();
  assert.equal(textureDisposals, 1, 'Growing the upload retires the old texture');
  layer.births.reset();
  layer.upload();
  assert.equal(layer.points.geometry.drawRange.count, 0);
  let finalDisposals = 0;
  layer.points.material.uniforms.uBirths.value.addEventListener('dispose', () => finalDisposals++);
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
