/** Poster capture exercises the production frame path without creating a WebGL context. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PosterRenderer } from '../src/view/poster.ts';
import { Viewer } from '../src/view/viewer.ts';
import { ParticleLayers } from '../src/view/buffers.ts';
import { GpuSprays } from '../src/view/gpu-sprays.ts';
import { reviewFixtureDesign, reviewFixtures } from '../src/fixtures/index.ts';
import { effectTemplates } from '../src/index.ts';
import { drawViewerFrame } from '../src/view/viewer-frame.ts';
import { SOURCE_SCALARS, SOURCE_COMPONENTS } from '../src/view/source-layout.ts';
import { reviewTime } from '../src/view/review-framing.ts';
const peony = reviewFixtureDesign('peony');

function surface(prototype = PosterRenderer.prototype) {
  const poster = Object.create(prototype);
  const encoders = [];
  let draws = 0;
  const layers = new ParticleLayers();
  Object.assign(poster, {
    disposed: false,
    renderer: {
      domElement: {
        dataset: {},
        toBlob(callback, format) {
          assert.equal(format, 'image/png');
          encoders.push(callback);
        },
      },
      setSize() {
        assert.fail('capture must never resize the drawing buffer');
      },
      setPixelRatio() {
        assert.fail('capture must never change display density');
      },
    },
    scene: new THREE.Scene(),
    props: new THREE.Group(),
    camera: new THREE.PerspectiveCamera(45, 1.6, 0.5, 4000),
    layers,
    sprays: new GpuSprays(layers.uniforms),
    output: {
      render() {
        draws++;
      },
      resize() {
        assert.fail('capture must reuse the output target');
      },
    },
    profiler: { requested: false },
    world: { setSettings() {} },
    controls: { setFree() {}, frame() {} },
    options: {},
    sprayMode: 'gpu',
    count: 0,
    fillMs: 0,
    frameMs: 0,
  });
  return { poster, encoders, draws: () => draws };
}

test('sequential posters draw once each and await async PNG encoding without resizing', async () => {
  const rig = surface();
  const designBefore = structuredClone(peony);
  for (const time of [0, 2.2]) {
    const result = rig.poster.capture(peony, time);
    const blob = new Blob(['PNG'], { type: 'image/png' });
    assert.equal(rig.poster.t, time);
    assert.equal(rig.encoders.length, 1, 'one readback/encoding request per frame');
    rig.encoders.shift()(blob);
    assert.equal(await result, blob);
  }
  assert.equal(rig.draws(), 2);
  assert.deepEqual(peony, designBefore);
});

test('poster encoding failures stay visible and disposed capture cannot draw', async () => {
  const rig = surface();
  const result = rig.poster.capture(peony, 0);
  rig.encoders.shift()(null);
  await assert.rejects(result, /PNG encoding failed/);
  rig.poster.disposed = true;
  assert.throws(() => rig.poster.capture(peony, 0), /disposed/);
  assert.equal(rig.draws(), 1);
});

function packedFrame(rig) {
  const { poster } = rig;
  const sources = poster.sprays.sources;
  return {
    layers: poster.layers.group.children.map(({ geometry }) => ({
      count: geometry.instanceCount ?? geometry.drawRange.count,
      attributes: Object.fromEntries(
        Object.entries(geometry.attributes).map(([name, attribute]) => [
          name,
          attribute.array.slice(
            0,
            (geometry.instanceCount ?? geometry.drawRange.count) * attribute.itemSize,
          ),
        ]),
      ),
    })),
    sources: sources.data.slice(0, sources.sources * SOURCE_SCALARS),
    clocks: sources.clocks.slice(0, sources.sources * SOURCE_COMPONENTS),
    candidates: sources.count,
  };
}

test('paused live packed output survives interleaved poster captures and backwards seeks', async () => {
  // Replace only WebGL submission: live evaluation uses the Viewer frame path,
  // while thumbnail evaluation goes through PosterRenderer.capture with PNG encoding pending.
  const live = surface(Viewer.prototype);
  const thumbnail = surface();
  for (const key of [
    'peony',
    'willow',
    'crackle',
    'fountain',
    'wheel',
    'romanCandle',
    'multiBreak',
  ]) {
    live.poster.shots = [{ design: effectTemplates.find((entry) => entry.key === key).design }];
    live.poster.t = 2.2;
    drawViewerFrame(live.poster, live.poster.sprays);
    const first = packedFrame(live);
    for (const entry of [...effectTemplates, ...reviewFixtures]) {
      const capture = thumbnail.poster.capture(entry.design, reviewTime(entry.design));
      assert.deepEqual(packedFrame(live), first, 'capture must not mutate retained live output');
      drawViewerFrame(live.poster, live.poster.sprays);
      assert.deepEqual(packedFrame(live), first, `${key}: after ${entry.key} poster`);
      thumbnail.encoders.shift()(new Blob(['PNG'], { type: 'image/png' }));
      await capture;
    }
    live.poster.t = 0.5;
    drawViewerFrame(live.poster, live.poster.sprays);
    live.poster.t = 2.2;
    drawViewerFrame(live.poster, live.poster.sprays);
    assert.deepEqual(packedFrame(live), first, `${key}: repeated live evaluation`);
  }
});
