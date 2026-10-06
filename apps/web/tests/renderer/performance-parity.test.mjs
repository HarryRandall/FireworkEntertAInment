import test from 'node:test';
import assert from 'node:assert/strict';
import { visibleClock } from '../../ui/renderer/visible-clock.ts';
import { playbackReadoutGate } from '../../ui/renderer/playback-readout.ts';

test('external stage clock is demand driven, resumes visible playback and cleans up', () => {
  const saved = Object.fromEntries(
    ['document', 'IntersectionObserver', 'requestAnimationFrame', 'cancelAnimationFrame'].map(
      (key) => [key, globalThis[key]],
    ),
  );
  let observe;
  let disconnected = false;
  let id = 0;
  const callbacks = new Map();
  const document = new EventTarget();
  document.hidden = false;
  globalThis.document = document;
  globalThis.IntersectionObserver = class {
    constructor(callback) {
      observe = callback;
    }
    observe() {}
    disconnect() {
      disconnected = true;
    }
  };
  globalThis.requestAnimationFrame = (callback) => {
    callbacks.set(++id, callback);
    return id;
  };
  globalThis.cancelAnimationFrame = (key) => callbacks.delete(key);
  let running = false;
  let samples = 0;
  const clock = visibleClock(
    {},
    () => running,
    () => samples++,
  );
  const frame = () => {
    const [key, callback] = callbacks.entries().next().value;
    callbacks.delete(key);
    callback();
  };
  try {
    observe([{ isIntersecting: true }]);
    assert.equal(samples, 1);
    assert.equal(callbacks.size, 0, 'paused stage has no idle poll');
    running = true;
    clock.wake();
    for (let i = 0; i < 60; i++) frame();
    assert.equal(samples, 62, 'running ref stays at display cadence');
    observe([{ isIntersecting: true }, { isIntersecting: false }]);
    assert.equal(callbacks.size, 0, 'off-screen stage cancels its poll');
    observe([{ isIntersecting: true }]);
    assert.equal(callbacks.size, 1);
    document.hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(callbacks.size, 0);
    document.hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(callbacks.size, 1);
    clock.dispose();
    assert.equal(disconnected, true);
    assert.equal(callbacks.size, 0);
    document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(callbacks.size, 0);
  } finally {
    clock.dispose();
    Object.assign(globalThis, saved);
  }
});

test('editor, multishot and replay readouts commit at 10 Hz with immediate pause and seek', (t) => {
  for (const surface of ['editor', 'multishot transport', 'show replay transport']) {
    const gate = playbackReadoutGate();
    let updates = 0;
    for (let i = 0; i < 600; i++) {
      if (gate({ time: i / 60, duration: 20, playing: true }, (i * 1000) / 60)) updates++;
    }
    assert.equal(updates, 100);
    assert.equal(gate({ time: 10, duration: 20, playing: false }, 10000), true);
    assert.equal(gate({ time: 10, duration: 20, playing: false }, 10001), false);
    assert.equal(gate({ time: 2, duration: 20, playing: false }, 10002), true);
    t.diagnostic(`${surface}: 600 display ticks / 10 s, 600 -> ${updates} React clock commits`);
  }
});

test('a reused viewer reports every replacement sequence once after its draw, never on seek', async () => {
  const { viewerReadiness } = await import('../../ui/renderer/viewer-readiness.ts');
  let listener;
  let final = false;
  let scene = 0;
  let ready = 0;
  let unsubscribed = false;
  const viewer = {
    renderer: { domElement: { dataset: { drawPending: 'true' } } },
    on(callback) {
      listener = callback;
      callback();
      return () => {
        unsubscribed = true;
      };
    },
  };
  const watcher = viewerReadiness(viewer, () => ({
    final,
    scene: () => scene++,
    ready: () => ready++,
  }));
  assert.equal(scene, 0);
  viewer.renderer.domElement.dataset.drawPending = 'false';
  listener();
  assert.equal(scene, 1);
  assert.equal(ready, 0);
  final = true;
  watcher.report();
  assert.equal(ready, 1);
  for (let i = 0; i < 60; i++) listener();
  assert.equal(ready, 1);
  watcher.reset();
  viewer.renderer.domElement.dataset.drawPending = 'true';
  listener();
  assert.equal(ready, 1);
  viewer.renderer.domElement.dataset.drawPending = 'false';
  listener();
  assert.equal(scene, 2);
  assert.equal(ready, 2);
  watcher.dispose();
  assert.equal(unsubscribed, true);
});
