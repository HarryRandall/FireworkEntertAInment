/** Production transport and frame scheduling with deterministic clocks and stub output submission. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Viewer } from '../src/view/viewer.ts';
import { ParticleLayers } from '../src/view/buffers.ts';
import { GpuSprays } from '../src/view/gpu-sprays.ts';
import { StageControls } from '../src/view/stage-controls.ts';
import { FrameTimes } from '../src/view/frame-times.ts';
import { createHash } from 'node:crypto';
import { SOURCE_SCALARS, SOURCE_COMPONENTS } from '../src/view/source-layout.ts';
import { stressShots } from './support/stress-scene.ts';

// RAF timestamps are wall-clock milliseconds; the fixture starts at dense show seconds.
const SHOW_TIME_S = 11.2;

test('pause cancels queued playback, freezes camera easing and draws once before becoming idle', () => {
  const saved = {
    window: globalThis.window,
    document: globalThis.document,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
  };
  const callbacks = new Map();
  let nextId = 1;
  let draws = 0;
  let hushed = 0;
  const snapshot = () => ({
    layers: layers.group.children.map((object) => ({
      range: { ...object.geometry.drawRange },
      count: object.geometry.instanceCount,
      attributes: Object.fromEntries(
        Object.entries(object.geometry.attributes).map(([name, attribute]) => [
          name,
          createHash('sha256')
            .update(
              new Uint8Array(
                attribute.array.buffer,
                attribute.array.byteOffset,
                (attribute.updateRanges[0]?.count ?? attribute.array.length) *
                  attribute.array.BYTES_PER_ELEMENT,
              ),
            )
            .digest('hex'),
        ]),
      ),
    })),
    sourceData: Array.from(sprays.sources.data.slice(0, sprays.sources.sources * SOURCE_SCALARS)),
    sourceClocks: Array.from(
      sprays.sources.clocks.slice(0, sprays.sources.sources * SOURCE_COMPONENTS),
    ),
    sourceCount: sprays.sources.count,
  });
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  globalThis.document = { hidden: false };
  globalThis.requestAnimationFrame = (callback) => {
    const id = nextId++;
    callbacks.set(id, callback);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => {
    callbacks.delete(id);
  };
  const camera = new THREE.PerspectiveCamera();
  const controls = new StageControls(camera, new EventTarget(), () => {});
  controls.zoom(0.5);
  const layers = new ParticleLayers();
  const sprays = new GpuSprays(layers.uniforms);
  const viewer = Object.create(Viewer.prototype);
  Object.assign(viewer, {
    disposed: false,
    onScreen: true,
    raf: 0,
    dirty: false,
    playing: true,
    cameraMoving: true,
    last: 1000,
    t: SHOW_TIME_S,
    duration: 30,
    speed: 1,
    options: {},
    shots: stressShots(),
    listeners: new Set(),
    controls,
    camera,
    shake: [],
    shakeOffset: [0, 0, 0],
    cameraPosition: [0, 0, 0],
    layers,
    gpuSprays: sprays,
    sprayMode: 'gpu',
    sound: {
      hush() {
        hushed++;
      },
      frame() {},
      reset() {},
    },
    profiler: { waiting: false, requested: false, poll: () => false },
    frameTimes: new FrameTimes(),
    count: 0,
    fillMs: 0,
    frameMs: 0,
    renderer: { domElement: { dataset: {} } },
    scene: new THREE.Scene(),
    output: {
      render() {
        draws++;
      },
    },
    // Invoke the production frame method, replacing only the bound constructor callback.
    frame: (now) => viewer.drawFrame(now),
  });
  try {
    viewer.schedule();
    const queued = viewer.raf;
    assert.equal(callbacks.size, 1);
    assert.equal(viewer.renderer.domElement.dataset.drawnTime, undefined);
    viewer.pause();
    assert.equal(viewer.playing, false);
    assert.equal(viewer.t, SHOW_TIME_S);
    assert.equal(hushed, 1);
    assert.equal(callbacks.has(queued), false, 'queued playing callback is cancelled');
    assert.equal(callbacks.size, 1, 'one paused draw replaces it');
    const runFrame = (now) => {
      const [id, callback] = callbacks.entries().next().value;
      callbacks.delete(id);
      callback(now);
    };
    runFrame(2000);
    assert.equal(draws, 1);
    assert.equal(viewer.t, SHOW_TIME_S);
    assert.equal(viewer.renderer.domElement.dataset.drawnTime, SHOW_TIME_S.toFixed(6));
    assert.equal(callbacks.size, 0, 'no idle RAF or GPU draws after the paused frame');
    assert.equal(viewer.liveDrawPending, false);
    const denseFrame = snapshot();
    viewer.seek(11.205142857);
    assert.equal(viewer.renderer.domElement.dataset.drawnTime, SHOW_TIME_S.toFixed(6));
    assert.equal(viewer.renderer.domElement.dataset.drawPending, 'true');
    runFrame(2500);
    assert.equal(viewer.renderer.domElement.dataset.drawPending, 'false');
    assert.equal(viewer.t, 11.205142857);
    assert.equal(viewer.renderer.domElement.dataset.drawnTime, '11.205143');
    viewer.seek(14);
    runFrame(3000);
    viewer.seek(SHOW_TIME_S);
    runFrame(4000);
    assert.equal(viewer.t, SHOW_TIME_S);
    assert.deepEqual(
      snapshot(),
      denseFrame,
      'dense finale seek replay retains every CPU and GPU input',
    );
    assert.equal(callbacks.size, 0);
    viewer.play();
    assert.equal(
      viewer.liveDrawPending,
      true,
      'posters yield throughout playback, even without a dirty frame',
    );
    runFrame(5000);
    assert.equal(viewer.renderer.domElement.dataset.drawnTime, SHOW_TIME_S.toFixed(6));
    runFrame(5017.602142);
    assert.equal(viewer.t, SHOW_TIME_S + 0.017602142);
    assert.equal(viewer.renderer.domElement.dataset.drawnTime, viewer.t.toFixed(6));
  } finally {
    layers.dispose();
    sprays.dispose();
    controls.dispose();
    Object.assign(globalThis, saved);
  }
});
