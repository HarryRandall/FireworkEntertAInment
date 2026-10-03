/** Demand draws survive hidden stages and batched intersection notifications. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Viewer } from '../src/view/viewer.ts';
import { ParticleLayers } from '../src/view/buffers.ts';
import { GpuSprays } from '../src/view/gpu-sprays.ts';

test('a hidden pending seek draws once when the latest intersection becomes visible', () => {
  const saved = {
    window: globalThis.window,
    document: globalThis.document,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
  };
  const callbacks = new Map();
  let nextId = 1;
  let draws = 0;
  globalThis.window = { matchMedia: () => ({ matches: true }) };
  globalThis.document = { hidden: false };
  globalThis.requestAnimationFrame = (callback) => {
    const id = nextId++;
    callbacks.set(id, callback);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => callbacks.delete(id);
  const layers = new ParticleLayers();
  const sprays = new GpuSprays(layers.uniforms);
  const viewer = Object.create(Viewer.prototype);
  Object.assign(viewer, {
    disposed: false,
    onScreen: true,
    raf: 0,
    dirty: false,
    playing: false,
    cameraMoving: false,
    last: 0,
    t: 0.02,
    duration: 10,
    shots: [],
    listeners: new Set(),
    controls: { update: () => false, stop() {} },
    sound: { hush() {}, reset() {}, frame() {} },
    profiler: { waiting: false, requested: false, poll: () => false },
    layers,
    gpuSprays: sprays,
    count: 0,
    fillMs: 0,
    frameMs: 0,
    renderer: { domElement: { dataset: { drawnTime: '0.020000' } } },
    output: { render: () => draws++ },
    frame: (now) => viewer.drawFrame(now),
  });
  const notify = (...states) =>
    viewer.intersectionChanged(states.map((isIntersecting) => ({ isIntersecting })));
  const runFrame = () => {
    assert.equal(callbacks.size, 1, 'a visible pending draw must own a queued RAF');
    const [id, callback] = callbacks.entries().next().value;
    callbacks.delete(id);
    callback(1000);
  };
  try {
    viewer.seek(2.2);
    const cancelled = viewer.raf;
    notify(false);
    assert.equal(callbacks.has(cancelled), false, 'hiding cancels the queued draw');
    viewer.pause();
    viewer.seek(2.2);
    assert.equal(callbacks.size, 0, 'hidden stages defer GPU work');
    assert.equal(viewer.renderer.domElement.dataset.drawPending, 'true');
    assert.equal(viewer.renderer.domElement.dataset.drawnTime, '0.020000');
    // One observer watches one stage, but its queue can contain both scroll transitions.
    notify(false, true);
    assert.equal(callbacks.size, 1, 'batched re-entry re-arms the pending demand');
    assert.equal(viewer.liveDrawPending, true, 'posters yield to the re-armed live draw');
    notify(true);
    runFrame();
    assert.equal(draws, 1);
    assert.equal(viewer.renderer.domElement.dataset.drawnTime, '2.200000');
    assert.equal(viewer.renderer.domElement.dataset.drawPending, 'false');
    assert.equal(callbacks.size, 0, 'a completed paused demand returns to idle');
    assert.equal(viewer.liveDrawPending, false);

    viewer.seek(3);
    notify(true, false);
    assert.equal(callbacks.size, 0, 'the latest hidden entry also cancels correctly');
    notify(true);
    runFrame();
    assert.equal(draws, 2);
    assert.equal(viewer.renderer.domElement.dataset.drawnTime, '3.000000');
    assert.equal(viewer.renderer.domElement.dataset.drawPending, 'false');
    assert.equal(callbacks.size, 0);
  } finally {
    layers.dispose();
    sprays.dispose();
    Object.assign(globalThis, saved);
  }
});
