/** Audio transport and waveform behaviour tested in Node with an owned Web Audio graph double. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioContext } from './audio-context.mjs';
import { ViewerSound } from '../src/view/sound/scheduler.ts';
import { reviewFixtureDesign } from '../src/fixtures/index.ts';
import { SETTINGS } from '../src/view/settings.ts';
import { Viewer } from '../src/view/viewer.ts';
import { PerspectiveCamera } from 'three';
import { effectTemplates } from '../src/index.ts';
import { reviewFixtures } from '../src/fixtures/index.ts';
function rig(design = reviewFixtureDesign('peony')) {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const settings = { ...SETTINGS };
  AudioContext.instances = [];
  globalThis.document = new EventTarget();
  globalThis.window = { AudioContext };
  SETTINGS.sound = false;
  SETTINGS.volume = 0.7;
  const sound = new ViewerSound();
  sound.listen();
  sound.setShots([{ design }]);
  const interval = { from_s: 0, to_s: 0.02, speed: 1, listener: [0, 1.7, 100], right: [1, 0, 0] };
  return {
    sound,
    interval,
    design,
    context: () => AudioContext.instances[0],
    unlock() {
      SETTINGS.sound = true;
      document.dispatchEvent(new Event('pointerdown'));
    },
    cleanup() {
      sound.dispose();
      Object.assign(SETTINGS, settings);
      globalThis.document = previousDocument;
      globalThis.window = previousWindow;
    },
  };
}
const sources = (context) => context.nodes.filter((node) => node.starts.length > 0);
test('default mute and remembered sound require a gesture; first lift at zero schedules once', () => {
  const r = rig();
  try {
    r.sound.advance(r.interval);
    r.sound.frame({ t: 0.02, playing: true });
    assert.equal(AudioContext.instances.length, 0);
    SETTINGS.sound = true;
    r.sound.configure();
    assert.equal(AudioContext.instances.length, 0);
    r.unlock();
    r.sound.advance(r.interval);
    assert.equal(sources(r.context()).length, 5, 'four mortar sources plus a climb whoosh');
    const count = sources(r.context()).length;
    r.sound.advance({ ...r.interval, from_s: 0.02, to_s: 0.04 });
    assert.equal(sources(r.context()).length, count);
    const lag = Math.hypot(0.7, 100) / 343;
    assert.ok(Math.abs(sources(r.context())[0].starts[0][0] - (10 + lag)) < 1e-9);
    const filters = r.context().nodes.filter((node) => node.kind === 'filter');
    assert.ok(filters.some((node) => node.frequency.value < 16000 && node.frequency.value >= 700));
  } finally {
    r.cleanup();
  }
});

test('muted gestures cannot authorise later context creation outside a gesture', () => {
  const r = rig();
  try {
    document.dispatchEvent(new Event('pointerdown'));
    SETTINGS.sound = true;
    r.sound.configure();
    assert.equal(AudioContext.instances.length, 0);
    document.dispatchEvent(new Event('click'));
    assert.equal(
      AudioContext.instances.length,
      1,
      'unmute click creates the context after its handler',
    );
  } finally {
    r.cleanup();
  }
});

test('all 104 poster replacements retain shots without reading designs or allocating audio', () => {
  const r = rig();
  let reads = 0;
  try {
    const entries = [...effectTemplates, ...reviewFixtures];
    assert.equal(entries.length, 104);
    for (const entry of entries) {
      r.sound.setShots([
        {
          get design() {
            reads++;
            return entry.design;
          },
        },
      ]);
      r.sound.reset(2.2);
      r.sound.frame({ t: 2.2, playing: false });
    }
    assert.equal(reads, 0, 'poster setup and paused redraws never resolve acoustic cues');
    assert.equal(AudioContext.instances.length, 0);
    r.unlock();
    assert.equal(reads, 0, 'unmute prepares buffers but leaves cues to audible playback');
    r.sound.reset(0);
    r.sound.advance(r.interval);
    assert.equal(reads, 1, 'only the current design is resolved on first audible playback');
    r.sound.advance({ ...r.interval, from_s: 0.02, to_s: 0.04 });
    assert.equal(reads, 1, 'unchanged shots reuse their cues');
  } finally {
    r.cleanup();
  }
});
test('slow motion stretches distance lag and sustained climb duration', () => {
  const r = rig();
  try {
    r.unlock();
    r.sound.advance({ ...r.interval, speed: 0.25 });
    const nodes = sources(r.context());
    assert.ok(Math.abs(nodes[0].starts[0][0] - 10 - Math.hypot(0.7, 100) / 343 / 0.25) < 1e-9);
    const whoosh = nodes.find((node) => node.loop === true);
    assert.ok(
      Math.abs(whoosh.stops[0][0] - whoosh.starts[0][0] - r.design.launch.time_s / 0.25 - 0.3) <
        1e-9,
    );
  } finally {
    r.cleanup();
  }
});
test('suspended resume retains the launch interval, while pause/seek silence pending dry and echo nodes', () => {
  const r = rig();
  try {
    r.unlock();
    r.context().state = 'suspended';
    r.sound.advance(r.interval);
    assert.equal(sources(r.context()).length, 0);
    r.context().state = 'running';
    r.sound.advance({ ...r.interval, from_s: 0.02, to_s: 0.04 });
    assert.equal(sources(r.context()).length, 5);
    const nodes = [...r.context().nodes];
    r.sound.reset(2);
    assert.ok(nodes.every((node) => node.disconnected));
    assert.ok(sources(r.context()).every((node) => node.stops.at(-1).length === 0));
    r.sound.advance({ ...r.interval, from_s: 2, to_s: 2 });
    assert.equal(sources(r.context()).length, 5);
    r.sound.dispose();
    r.sound.dispose();
    assert.equal(r.context().state, 'closed');
    document.dispatchEvent(new Event('pointerdown'));
    assert.equal(AudioContext.instances.length, 1, 'disposed gestures cannot recreate audio');
  } finally {
    r.cleanup();
  }
});
test('mute and zero volume disconnect echoes; volume updates do not change the saved mute choice', () => {
  const r = rig();
  try {
    r.unlock();
    r.sound.advance(r.interval);
    SETTINGS.volume = 0.2;
    r.sound.configure();
    assert.equal(r.context().nodes[0].gain.value, 0.2);
    SETTINGS.sound = false;
    r.sound.configure();
    assert.ok(r.context().nodes.every((node) => node.disconnected));
    SETTINGS.sound = true;
    SETTINGS.volume = 0;
    r.sound.configure();
    const count = sources(r.context()).length;
    r.sound.advance({ ...r.interval, from_s: 1, to_s: 3 });
    assert.equal(sources(r.context()).length, count);
    assert.equal(SETTINGS.sound, true);
  } finally {
    r.cleanup();
  }
});

test('a failed view mount cannot leave an unlock listener or context behind', () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const soundChoice = SETTINGS.sound;
  AudioContext.instances = [];
  globalThis.document = new EventTarget();
  globalThis.window = { AudioContext };
  SETTINGS.sound = true;
  const sound = new ViewerSound();
  try {
    document.dispatchEvent(new Event('pointerdown'));
    assert.equal(
      AudioContext.instances.length,
      0,
      'construction before a successful mount has no side effects',
    );
  } finally {
    sound.dispose();
    SETTINGS.sound = soundChoice;
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test('viewer transport silences seeks and paused redraws, then replays the zero lift after restart or loop', () => {
  const r = rig();
  const viewer = Object.create(Viewer.prototype);
  Object.assign(viewer, {
    sound: r.sound,
    disposed: false,
    camera: new PerspectiveCamera(),
    t: 0,
    playing: false,
    duration: 10,
    speed: 1,
    last: 0,
    emit() {},
    schedule() {},
    cancelFrame() {
      this.sound.hush();
    },
    controls: { stop() {} },
    invalidate() {},
  });
  viewer.camera.position.set(0, 1.7, 100);
  viewer.camera.updateMatrixWorld();
  viewer.camera.updateMatrixWorld = () => {
    assert.fail('Sound sampling must not update the renderer camera matrices');
  };
  try {
    r.unlock();
    viewer.play();
    viewer.t = 0.02;
    r.sound.frame(viewer);
    const firstCount = sources(r.context()).length;
    assert.equal(firstCount, 5);
    viewer.pause();
    viewer.camera.position.x = 10;
    const pose = viewer.camera.toJSON();
    const pausedClock = { t: viewer.t, last: viewer.last, playing: viewer.playing };
    r.sound.frame(viewer);
    assert.equal(sources(r.context()).length, firstCount, 'paused camera redraw is silent');
    assert.deepEqual(viewer.camera.toJSON(), pose, 'paused audio does not mutate the camera');
    assert.deepEqual({ t: viewer.t, last: viewer.last, playing: viewer.playing }, pausedClock);
    viewer.seek(3);
    r.sound.frame(viewer);
    assert.equal(sources(r.context()).length, firstCount, 'seek does not replay crossed burst');
    viewer.seek(0);
    viewer.play();
    viewer.t = 0.02;
    r.sound.frame(viewer);
    assert.equal(sources(r.context()).length, firstCount * 2);
    viewer.setSpeed(0.25);
    assert.ok(
      sources(r.context()).every((node) => node.stops.at(-1).length === 0),
      'old-speed audio is discarded',
    );
    viewer.t = 9;
    r.sound.frame(viewer);
    const beforeLoop = sources(r.context()).length;
    viewer.t = 0.02;
    r.sound.frame(viewer);
    assert.equal(
      sources(r.context()).length,
      beforeLoop + firstCount,
      'loop gets a fresh zero lift',
    );
    const afterLoop = sources(r.context()).length;
    viewer.seek(3);
    viewer.t = 3.02;
    r.sound.frame(viewer);
    assert.equal(sources(r.context()).length, afterLoop, 'playing seek skips the discontinuity');
  } finally {
    r.cleanup();
  }
});

test('audio initialisation and synchronous resume failures stay visible without escaping a gesture', () => {
  const r = rig();
  const warn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args);
  try {
    window.AudioContext = class {
      constructor() {
        throw new Error('AudioContext unavailable');
      }
    };
    r.unlock();
    assert.equal(warnings.at(-1)[1].message, 'AudioContext unavailable');
    window.AudioContext = class extends AudioContext {
      createBuffer() {
        throw new Error('Buffer allocation failed');
      }
    };
    r.unlock();
    assert.equal(warnings.at(-1)[1].message, 'Buffer allocation failed');
    // Retry the owned context on a later gesture, then exercise a synchronous browser failure.
    const context = r.context();
    context.createBuffer = AudioContext.prototype.createBuffer;
    context.resume = () => {
      throw new Error('Resume failed');
    };
    r.unlock();
    assert.equal(warnings.at(-1)[1].message, 'Resume failed');
    context.resume = () => {
      assert.fail('Preference updates must not resume outside a gesture');
    };
    r.sound.configure();
    r.sound.reset(2.2);
    r.sound.frame({ t: 2.2, playing: false });
  } finally {
    console.warn = warn;
    r.cleanup();
  }
});
