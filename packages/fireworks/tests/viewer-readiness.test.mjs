/** Review readiness uses the production lifecycle and transport with only the WebGL surface replaced. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Element } from './viewer-dom.mjs';
import { AudioContext } from './audio-context.mjs';
import { Viewer } from '../src/view/viewer.ts';
import { ViewerSound } from '../src/view/sound/scheduler.ts';
import { SETTINGS } from '../src/view/settings.ts';
import { FrameTimes } from '../src/view/frame-times.ts';
import { entries } from '../../../apps/web/app/dev/fireworks/_components/review-catalogue.ts';
import { mountReviewViewer } from '../../../apps/web/app/dev/fireworks/_components/review-viewer-lifecycle.ts';

class PendingAudioContext extends AudioContext {
  resumes = 0;
  resume() {
    this.resumes++;
    return new Promise(() => {});
  }
}

function mount(Context) {
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    HTMLInputElement: globalThis.HTMLInputElement,
    requestAnimationFrame: globalThis.requestAnimationFrame,
  };
  const saved = { ...SETTINGS };
  AudioContext.instances = [];
  globalThis.window = new EventTarget();
  window.AudioContext = Context;
  window.localStorage = { getItem: () => JSON.stringify({ ...saved, sound: true }), setItem() {} };
  globalThis.document = new Element('document');
  document.createElement = (tag) => new Element(tag);
  globalThis.HTMLInputElement = Element;
  // An occluded/hidden browser may never deliver this callback. Preparation must still complete.
  globalThis.requestAnimationFrame = () => 1;
  SETTINGS.sound = true;
  const sound = new ViewerSound();
  sound.listen();
  const viewer = Object.create(Viewer.prototype);
  const captures = [];
  Object.assign(viewer, {
    container: new Element('div'),
    listeners: new Set(),
    disposed: false,
    sound,
    options: {},
    t: 0,
    speed: 1,
    duration: 10,
    playing: false,
    shots: [],
    output: { hdr: true },
    frameTimes: new FrameTimes(),
    profiler: { result: null },
    schedule() {},
    cancelFrame() {
      sound.hush();
    },
    controls: { stop() {} },
    invalidate() {},
    // WebGL-only operations are replaced; seeks, notifications and player mount use production code.
    setShots(shots) {
      this.shots = shots;
      sound.setShots(shots);
      this.emit();
    },
    dispose() {
      sound.dispose();
    },
  });
  Object.defineProperty(viewer, 'liveDrawPending', { value: false, writable: true });
  let finishCapture;
  let posterDisposed = false;
  const encoded = new Promise((resolve) => {
    finishCapture = resolve;
  });
  let captureStarted;
  const firstCapture = new Promise((resolve) => {
    captureStarted = resolve;
  });
  const posterRenderer = {
    capture(design) {
      captures.push(design);
      captureStarted();
      return encoded;
    },
    dispose() {
      posterDisposed = true;
    },
  };
  let posters;
  let finishPosters;
  const allPosters = new Promise((resolve) => {
    finishPosters = resolve;
  });
  const readies = [];
  const errors = [];
  let markReady;
  const ready = new Promise((resolve) => {
    markReady = resolve;
  });
  const ref = { current: null };
  const cleanup = mountReviewViewer(
    {
      setReady(value) {
        readies.push(value);
        if (value) markReady();
      },
      setError(value) {
        if (value) errors.push(value);
      },
      setPosters(value) {
        posters = typeof value === 'function' ? value(posters) : value;
        if (Object.keys(posters).length === entries.length) finishPosters();
      },
      setState() {},
      setSelected() {},
    },
    ref,
    () => viewer,
    () => posterRenderer,
  );
  return {
    viewer,
    ready,
    allPosters,
    readies,
    errors,
    captures,
    firstCapture,
    finishCapture: () => finishCapture(new Blob(['poster'], { type: 'image/png' })),
    posterDisposed: () => posterDisposed,
    stop: cleanup,
    ref,
    posters: () => posters,
    cleanup() {
      cleanup();
      Object.assign(SETTINGS, saved);
      Object.assign(globalThis, previous);
    },
  };
}

for (const [name, Context] of [
  ['unavailable', undefined],
  ['resume never settles', PendingAudioContext],
]) {
  test(
    `review mounts its player and becomes ready with AudioContext ${name}`,
    { timeout: 5000 },
    async () => {
      const rig = mount(Context);
      try {
        assert.equal(
          AudioContext.instances.length,
          0,
          'remembered sound cannot create audio on mount',
        );
        document.dispatchEvent(new Event('pointerdown'));
        if (Context) {
          assert.equal(AudioContext.instances.length, 1);
          assert.equal(
            AudioContext.instances[0].resumes,
            1,
            'exercise the unresolved resume during preparation',
          );
          assert.equal(AudioContext.instances[0].state, 'suspended');
        }
        await rig.ready;
        assert.deepEqual(rig.readies, [false, true]);
        assert.deepEqual(rig.errors, []);
        assert.deepEqual(rig.captures, [], 'ready precedes the first capture task');
        assert.equal(Object.keys(rig.posters()).length, 0);
        await new Promise((resolve) => setTimeout(resolve));
        assert.deepEqual(rig.captures, [entries[0].design]);
        assert.equal(rig.ref.current, rig.viewer);
        assert.ok(rig.viewer.container.find((element) => element.textContent === 'Play'));
        rig.viewer.seek(2.2);
        assert.equal(rig.viewer.t, 2.2, 'audio cannot prevent transport changes');
        rig.finishCapture();
        await new Promise((resolve) => setTimeout(resolve));
        assert.equal(Object.keys(rig.posters()).length, 1, 'posters publish progressively');
        assert.equal(rig.viewer.t, 2.2, 'background posters cannot seek the live viewer');
      } finally {
        rig.cleanup();
      }
      if (Context) assert.equal(AudioContext.instances[0].closed, true);
    },
  );
}

test('navigation during PNG encoding disposes the poster renderer and ignores the result', async () => {
  const rig = mount(undefined);
  try {
    await rig.ready;
    await new Promise((resolve) => setTimeout(resolve));
    assert.equal(rig.captures.length, 1);
    rig.stop();
    assert.equal(rig.posterDisposed(), true);
    assert.equal(rig.ref.current, null);
    rig.finishCapture();
    await new Promise((resolve) => setTimeout(resolve));
    assert.equal(Object.keys(rig.posters()).length, 0);
    assert.equal(rig.captures.length, 1);
    assert.deepEqual(rig.errors, []);
  } finally {
    rig.cleanup();
  }
});

test(
  'all posters arrive progressively and navigation revokes their URLs',
  { timeout: 5000 },
  async () => {
    const rig = mount(undefined);
    try {
      await rig.ready;
      rig.finishCapture();
      await rig.allPosters;
      assert.deepEqual(
        rig.captures,
        entries.map((entry) => entry.design),
      );
      const urls = Object.values(rig.posters());
      assert.equal(urls.length, entries.length);
      assert.equal((await fetch(urls[0])).status, 200);
      rig.stop();
      await assert.rejects(fetch(urls[0]), /fetch failed/);
      assert.equal(rig.posterDisposed(), true);
    } finally {
      rig.cleanup();
    }
  },
);

test('navigation before preparation starts creates no thumbnail context', async () => {
  const rig = mount(undefined);
  try {
    rig.stop();
    await new Promise((resolve) => setTimeout(resolve));
    assert.deepEqual(rig.captures, []);
    assert.equal(rig.posterDisposed(), false);
  } finally {
    rig.cleanup();
  }
});

test('progressive posters yield to a pending live draw without waiting for PNG encoding', async () => {
  const rig = mount(undefined);
  try {
    rig.viewer.liveDrawPending = true;
    await rig.ready;
    await new Promise((resolve) => setTimeout(resolve));
    assert.deepEqual(rig.captures, [], 'no thumbnail may start ahead of a pending live draw');
    rig.viewer.liveDrawPending = false;
    await rig.firstCapture;
    assert.equal(rig.captures.length, 1);
    rig.viewer.seek(2.2);
    assert.equal(
      rig.viewer.t,
      2.2,
      'live transport proceeds while PNG encoding remains unresolved',
    );
    rig.viewer.liveDrawPending = true;
    rig.finishCapture();
    await new Promise((resolve) => setTimeout(resolve));
    assert.equal(Object.keys(rig.posters()).length, 1);
    assert.equal(rig.captures.length, 1, 'the next poster also yields to a new live demand');
    rig.stop();
    rig.viewer.liveDrawPending = false;
    await new Promise((resolve) => setTimeout(resolve));
    assert.equal(rig.captures.length, 1, 'cancellation ends the priority wait');
  } finally {
    rig.cleanup();
  }
});
