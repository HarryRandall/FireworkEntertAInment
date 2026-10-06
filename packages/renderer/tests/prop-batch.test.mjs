/** Static scene accounting and geometry parity without a browser or GL driver. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { batchProps } from '../src/view/prop-batch.ts';
import { makeProps } from '../src/view/props.ts';
import { stressShots } from './support/stress-scene.ts';
import { disposeTree, makeWorld } from '../src/view/world.ts';
import { ParticleLayers } from '../src/view/buffers.ts';
import { GpuSprays } from '../src/view/gpu-sprays.ts';
import { OutputPass } from '../src/view/output.ts';

function meshes(group) {
  const result = [];
  group.traverse((object) => {
    if (object.isMesh) result.push(object);
  });
  return result;
}

test('forty-shot hardware uses one draw, with no per-face or per-shot groups', () => {
  const group = makeProps(stressShots(), 'mortar');
  const drawables = meshes(group);
  assert.equal(drawables.length, 1);
  assert.equal(drawables[0].geometry.groups.length, 0);
  assert.equal(Array.isArray(drawables[0].material), false);
  // The original 21 unique positions each had a body, lip and foot: 63 draws.
  // Two static-world draws after removing decorative stars, three CPU layers, one GPU spray
  // and one output add seven fixed draws; the batched hardware remains the eighth.
  const scene = new THREE.Scene();
  makeWorld(scene);
  const layers = new ParticleLayers();
  const sprays = new GpuSprays(layers.uniforms);
  scene.add(group, layers.group, sprays.points);
  let submissions = 0;
  const renderer = {
    extensions: { has: () => false },
    setRenderTarget() {},
    render(tree) {
      tree.traverse((object) => {
        if (!object.isMesh && !object.isPoints) return;
        assert.equal(Array.isArray(object.material), false);
        assert.equal(object.geometry.groups.length === 0 || object.material.isShaderMaterial, true);
        submissions++;
      });
    },
  };
  const output = new OutputPass(renderer);
  output.render(renderer, scene, new THREE.Camera());
  assert.equal(
    submissions,
    8,
    'full live scene plus output stays within a shot-independent draw budget',
  );
  console.log(`Finale scene draw budget: 70 before, ${submissions} after (hardware 63 -> 1)`);
  scene.remove(layers.group, sprays.points);
  layers.dispose();
  sprays.dispose();
  output.dispose();
  disposeTree(scene);
});

test('batching retains transformed vertices, triangle order and linear material colours', () => {
  const source = new THREE.Group();
  source.position.set(4, 0, -2);
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 2, 3),
    new THREE.MeshBasicMaterial({ color: 0x5a2226 }),
  );
  mesh.position.set(2, 5, 3);
  mesh.rotation.z = Math.PI / 6;
  source.add(mesh);
  source.updateMatrixWorld(true);
  const expected = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
  const colour = mesh.material.color.clone();
  let geometryDisposed = false;
  let materialDisposed = false;
  mesh.geometry.addEventListener('dispose', () => {
    geometryDisposed = true;
  });
  mesh.material.addEventListener('dispose', () => {
    materialDisposed = true;
  });
  const group = batchProps(source);
  const [batch] = meshes(group);
  assert.deepEqual(
    batch.geometry.getAttribute('position').array,
    expected.getAttribute('position').array,
  );
  assert.deepEqual(batch.geometry.index.array, expected.index.array);
  const colours = batch.geometry.getAttribute('color');
  for (let index = 0; index < colours.count; index++) {
    for (const [actual, wanted] of [
      [colours.getX(index), colour.r],
      [colours.getY(index), colour.g],
      [colours.getZ(index), colour.b],
    ]) {
      assert.ok(Math.abs(actual - wanted) < 1e-7);
    }
  }
  assert.equal(geometryDisposed, true);
  assert.equal(materialDisposed, true);
  expected.dispose();
  disposeTree(group);
});

test('cake holes share the single hardware draw and empty hardware has none', () => {
  const cake = makeProps(stressShots(), 'cake');
  assert.equal(meshes(cake).length, 1);
  disposeTree(cake);
  assert.equal(meshes(makeProps([], 'mortar')).length, 0);
});
