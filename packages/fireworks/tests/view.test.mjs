/** GPU attribute routing and hardware lifetimes are exercised without a browser. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ParticleLayers } from '../src/view/buffers.ts';
import { makeProps, cakeHole, CAKE_TOP_M } from '../src/view/props.ts';
import { disposeTree } from '../src/view/world.ts';
import { effectTemplates } from '../src/templates/index.ts';
import { simulate } from '../src/sim/index.ts';

const peony = effectTemplates.find((template) => template.key === 'peony').design;
// Developed burst sample in seconds, from the prototype review fixture.
const DEVELOPED_TIME_S = 2.2;

test('CPU particle frames route sparks, glows and smoke into the correct draw attributes', () => {
  const layers = new ParticleLayers();
  const frame = simulate(peony, DEVELOPED_TIME_S);
  layers.upload([frame]);
  const [smoke, quads, points] = layers.group.children;
  assert.notEqual(
    smoke.geometry.getAttribute('position'),
    quads.geometry.getAttribute('position'),
    'Billboard bases have independent GPU lifetimes',
  );
  assert.notEqual(smoke.geometry.index, quads.geometry.index);
  assert.equal(points.geometry.drawRange.count, frame.kinds.filter((kind) => kind === 0).length);
  assert.equal(quads.geometry.instanceCount, frame.kinds.filter((kind) => kind !== 0).length);
  assert.equal(smoke.geometry.instanceCount, frame.smoke.sizes.length);
  assert.deepEqual(
    [...smoke.geometry.getAttribute('iSeed').array.slice(0, 2)],
    [frame.smoke.seeds[0], frame.smoke.ages[0]],
  );
  const position = points.geometry.getAttribute('position');
  layers.upload([frame]);
  assert.equal(
    points.geometry.getAttribute('position'),
    position,
    'Existing GPU allocation is reused',
  );
  layers.upload([frame, frame]);
  assert.equal(
    points.geometry.drawRange.count,
    frame.kinds.filter((kind) => kind === 0).length * 2,
  );
  layers.upload([]);
  assert.equal(points.geometry.drawRange.count, 0);
  assert.equal(quads.geometry.instanceCount, 0);
  assert.equal(smoke.geometry.instanceCount, 0);
  layers.dispose();
});

test('shared hardware resources dispose once and cake tubes wrap at their own top height', () => {
  const props = makeProps([{ design: peony }, { design: peony }], 'mortar');
  assert.equal(props.children.length, 1, 'Shared launch position owns one mortar');
  assert.deepEqual(cakeHole(0), cakeHole(25));
  const cake = makeProps([], 'cake');
  assert.equal(cake.children.length, 1, 'Cake box, lid and holes share one draw');
  const vertices = cake.children[0].geometry.getAttribute('position');
  assert.ok(
    Array.from({ length: vertices.count }, (_, index) => vertices.getY(index)).some(
      (height) => Math.abs(height - CAKE_TOP_M) < 1e-6,
    ),
    'Baked holes retain their muzzle height',
  );
  let materialDisposals = 0;
  cake.children[0].material.addEventListener('dispose', () => materialDisposals++);
  disposeTree(cake);
  assert.equal(materialDisposals, 1, 'Batched hardware material is freed once');
  disposeTree(props);
});

test('direct packing retains every scalar lane and order across mixed frames and shrinking uploads', () => {
  const layers = new ParticleLayers();
  const frames = [simulate(peony, 0.7), simulate(peony, DEVELOPED_TIME_S), simulate(peony, 3.4)];
  for (const input of [frames, frames.slice(1), [], frames]) {
    layers.upload(input);
    const [smoke, quads, points] = layers.group.children;
    for (const [mesh, instanced] of [
      [points, false],
      [quads, true],
    ]) {
      const expected = { position: [], colour: [], size: [], alpha: [], shape: [] };
      for (const frame of input) {
        for (let index = 0; index < frame.kinds.length; index++) {
          const kind = frame.kinds[index];
          if ((kind !== 0) !== instanced) continue;
          expected.position.push(...frame.positions.slice(index * 3, (index + 1) * 3));
          expected.colour.push(...frame.colours.slice(index * 3, (index + 1) * 3));
          expected.size.push(frame.sizes[index]);
          expected.alpha.push(frame.alphas[index]);
          expected.shape.push(kind === 3 ? 0 : kind);
        }
      }
      for (const [key, attribute] of [
        ['position', instanced ? 'iPos' : 'position'],
        ['colour', instanced ? 'iColor' : 'color'],
        ['size', instanced ? 'iSize' : 'size'],
        ['alpha', instanced ? 'iAlpha' : 'alpha'],
        ...(instanced ? [['shape', 'iShape']] : []),
      ]) {
        const values = mesh.geometry.getAttribute(attribute).array;
        assert.deepEqual([...values.slice(0, expected[key].length)], expected[key], attribute);
      }
    }
    assert.equal(
      smoke.geometry.instanceCount,
      input.reduce((sum, frame) => sum + frame.smoke.sizes.length, 0),
    );
  }
  layers.dispose();
});
