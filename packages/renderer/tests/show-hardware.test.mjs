/** Mixed hardware remains present independently of the playhead. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3 } from 'three';
import { makeProps } from '../src/view/props.ts';
import { effectTemplates } from '../src/templates/index.ts';
import { disposeTree } from '../src/view/world.ts';
const design = effectTemplates.find((entry) => entry.key === 'peony').design;
const vertexCount = (group) => group.children[0].geometry.getAttribute('position').count;

test('mixed hardware deduplicates cake footprints, rather than child tube positions', () => {
  const cake = makeProps([{ design, hardware: 'cake', hardwarePosition: [4, 3] }], 'mortar');
  const mortar = makeProps([{ design, position: [-4, 0] }], 'mortar');
  const mixed = makeProps(
    [
      { design, t0: 30, hardware: 'cake', hardwarePosition: [4, 3], position: [3.8, 2.8] },
      { design, t0: 60, hardware: 'cake', hardwarePosition: [4, 3], position: [4.2, 3.2] },
      { design, position: [-4, 0] },
    ],
    'mortar',
  );
  assert.equal(vertexCount(mixed), vertexCount(cake) + vertexCount(mortar));
  const bounds = new Box3().setFromObject(mixed);
  assert.ok(bounds.max.x > 5);
  assert.ok(bounds.min.x < -4);
  for (const group of [cake, mortar, mixed]) disposeTree(group);
});
test('single cake editor geometry stays at the origin', () => {
  const group = makeProps([{ design, position: [100, 100] }], 'cake');
  const bounds = new Box3().setFromObject(group);
  assert.ok(Math.abs(bounds.getCenter(bounds.min.clone()).x) < 0.001);
  disposeTree(group);
});

test('show audience margin increases distance without moving the target or editor default', async () => {
  const { audienceFraming } = await import('../src/view/audience-framing.ts');
  const view = { shots: [{ design }], camera: { aspect: 1.6, fov: 45 }, options: {} };
  const normal = audienceFraming(view);
  const show = audienceFraming({ ...view, options: { framingDistanceScale: 1.1 } });
  assert.deepEqual(show.target, normal.target);
  const distance = (frame) =>
    Math.hypot(...frame.position.map((value, index) => value - frame.target[index]));
  assert.ok(Math.abs(distance(show) / distance(normal) - 1.1) < 1e-10);
});
