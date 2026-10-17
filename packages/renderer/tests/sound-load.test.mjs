/** Bounded effect audio on dense shows: culling, stall catch-up and clock continuity in Node. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioContext } from './audio-context.mjs';
import {
  ViewerSound,
  MAX_CUES_PER_SECOND,
  MAX_CUES_PER_TICK,
  cuePriority,
} from '../src/view/sound/scheduler.ts';
import { isClockDiscontinuity, syncViewerClock } from '../src/view/external-clock.ts';
import { reviewFixtureDesign } from '../src/fixtures/index.ts';
import { soundEvents } from '../src/sim/events.ts';
import { SETTINGS } from '../src/view/settings.ts';

const INTERVAL = { speed: 1, listener: [0, 1.7, 100], right: [1, 0, 0] };

/** A finale-sized volley: `count` peony shots fired within `spread_s` seconds from `t0`. */
function volley(count, t0 = 0, spread_s = 0.3) {
  const design = reviewFixtureDesign('peony');
  return Array.from({ length: count }, (_, index) => ({
    design,
    t0: t0 + (spread_s * index) / Math.max(1, count - 1),
    position: [index * 2 - count, 0],
    seed: index,
  }));
}

function rig(shots) {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const settings = { ...SETTINGS };
  AudioContext.instances = [];
  globalThis.document = new EventTarget();
  globalThis.window = { AudioContext };
  SETTINGS.sound = true;
  SETTINGS.volume = 0.7;
  const sound = new ViewerSound();
  sound.listen();
  sound.setShots(shots);
  document.dispatchEvent(new Event('pointerdown'));
  const context = AudioContext.instances[0];
  context.state = 'running';
  return {
    sound,
    context,
    /** Distinct cue starts scheduled so far: one per event, whatever its source count. */
    cues: () => new Set(context.nodes.filter((node) => node.kind === 'panner')).size,
    cleanup() {
      sound.dispose();
      Object.assign(SETTINGS, settings);
      globalThis.document = previousDocument;
      globalThis.window = previousWindow;
    },
  };
}

test('a dense volley is culled to the per-tick and per-second budgets, keeping breaks over lifts', () => {
  const shots = volley(40, 0, 0.9);
  const events = soundEvents(shots);
  assert.ok(events.filter((event) => event.time_s <= 0.9).length >= 80, 'lifts and whooshes');
  const r = rig(shots);
  try {
    r.sound.reset(0);
    r.sound.advance({ ...INTERVAL, from_s: 0, to_s: 0.3 });
    assert.equal(r.cues(), MAX_CUES_PER_TICK, 'one tick never schedules more than its budget');
    // Frames keep crossing new lifts, but the second-long window stops at its own cap.
    for (let frame = 1; frame <= 42; frame++) {
      r.sound.advance({ ...INTERVAL, from_s: 0.3 + (frame - 1) / 60, to_s: 0.3 + frame / 60 });
    }
    assert.equal(r.cues(), MAX_CUES_PER_SECOND, 'the per-second cap bounds the mix');
    // The breaks land a second and a half later; the budget is per second of sequence time,
    // so they still get their voices rather than being starved by the earlier lifts.
    const beforeBreaks = r.cues();
    for (let frame = 0; frame < 60; frame++) {
      r.sound.advance({ ...INTERVAL, from_s: 1.6 + frame / 60, to_s: 1.6 + (frame + 1) / 60 });
    }
    assert.ok(r.cues() > beforeBreaks, 'breaks after the lifts still play');
    assert.ok(r.cues() <= beforeBreaks + MAX_CUES_PER_SECOND);
    const booms = r.context.nodes.filter(
      (node) => node.kind === 'filter' && node.type === 'highpass',
    );
    assert.ok(booms.length >= MAX_CUES_PER_TICK, 'boom cracks were scheduled');
  } finally {
    r.cleanup();
  }
});

test('priority prefers breaks, loud and heavy cues and nearer sources, deterministically', () => {
  const base = { kind: 'boom', loud: false, heavy: false, quiet: false, soft: false, size: 1 };
  assert.ok(cuePriority(base, 50) > cuePriority({ ...base, kind: 'lift' }, 50));
  assert.ok(
    cuePriority({ ...base, kind: 'lift' }, 50) > cuePriority({ ...base, kind: 'hiss' }, 50),
  );
  assert.ok(cuePriority({ ...base, loud: true }, 50) > cuePriority(base, 50));
  assert.ok(cuePriority({ ...base, heavy: true }, 50) > cuePriority(base, 50));
  assert.ok(cuePriority({ ...base, quiet: true }, 50) < cuePriority(base, 50));
  assert.ok(cuePriority(base, 50) > cuePriority(base, 400));
  assert.equal(cuePriority(base, 50), cuePriority(base, 50));
});

test('a stalled frame replays only the trailing catch-up window instead of the whole backlog', () => {
  // Shots a second apart: a 3 s stall must not fire three seconds of lifts and breaks at once.
  const design = reviewFixtureDesign('peony');
  const shots = Array.from({ length: 10 }, (_, index) => ({ design, t0: index, seed: index }));
  const r = rig(shots);
  try {
    r.sound.reset(4.5);
    r.sound.advance({ ...INTERVAL, from_s: 4.5, to_s: 7.5 });
    const times = soundEvents(shots).filter(
      (event) => event.time_s > 6.9 && event.time_s <= 7.5,
    ).length;
    assert.equal(r.cues(), times, 'only cues inside the last 0.6 s were scheduled');
  } finally {
    r.cleanup();
  }
});

test('a small backward media jitter mid-show is a seek, not a replay from zero', () => {
  const design = reviewFixtureDesign('peony');
  const shots = Array.from({ length: 30 }, (_, index) => ({ design, t0: index, seed: index }));
  const r = rig(shots);
  const camera = {
    position: { toArray: (out) => ((out[0] = 0), (out[1] = 1.7), (out[2] = 100)) },
    matrixWorld: { elements: [1, 0, 0] },
  };
  const viewer = { t: 20, playing: true, speed: 1, camera };
  try {
    r.sound.reset(20);
    viewer.t = 20.02;
    r.sound.frame(viewer);
    const before = r.cues();
    // The media clock settles 40 ms earlier after a seek lands.
    viewer.t = 19.98;
    r.sound.frame(viewer);
    assert.equal(r.cues(), before, 'nothing replays on the backward tick');
    viewer.t = 20.03;
    r.sound.frame(viewer);
    const expected = soundEvents(shots).filter((e) => e.time_s > 19.98 && e.time_s <= 20.03).length;
    assert.equal(r.cues(), before + expected, 'playback resumes from the jitter point');
    // A loop back into the opening still replays the zero lift.
    viewer.t = 0.02;
    r.sound.frame(viewer);
    assert.ok(r.cues() > before + expected, 'restart replays the opening');
  } finally {
    r.cleanup();
  }
});

test('slow continuous playback never resets the voices; seeks and pauses still do', () => {
  // Media advancing by the real time that passed is playback, however slow the frames.
  assert.equal(isClockDiscontinuity(10, 10.2, true, 0.2), false, '5 FPS frame');
  assert.equal(isClockDiscontinuity(10, 12, true, 2), false, 'two-second stall');
  assert.equal(isClockDiscontinuity(10, 40, true, 30), false, 'tab hidden for half a minute');
  assert.equal(isClockDiscontinuity(10, 10.25, true, 0.016), false, 'coarse media clock step');
  // Media advancing far beyond the real time that passed is a seek.
  assert.equal(isClockDiscontinuity(10, 11.5, true, 0.016), true, 'forward seek');
  assert.equal(isClockDiscontinuity(10, 40, true, 0.2), true, 'forward seek on a slow frame');
  assert.equal(isClockDiscontinuity(10, 9.8, true, 0.016), true, 'backward seek');
  assert.equal(isClockDiscontinuity(10, 9.95, true, 0.016), false, 'media settle jitter');
  assert.equal(isClockDiscontinuity(10, 10.4, false, 5), true, 'paused scrub');
  assert.equal(isClockDiscontinuity(10, 10.4, true, null), true, 'first sample is not trusted');

  let resets = 0;
  let hushes = 0;
  const viewer = {
    t: 0,
    duration: 200,
    playing: false,
    externalClock: false,
    clockSampledAt_s: null,
    invalidate() {},
  };
  const sound = {
    reset() {
      resets++;
    },
    hush() {
      hushes++;
    },
  };
  let now = 100;
  const sample = (time, playing, wall) => {
    now += wall;
    syncViewerClock(viewer, sound, { time_s: time, playing, now_s: now });
  };
  sample(0, true, 0);
  assert.equal(resets, 1, 'starting resets once');
  // Sixty frames at 6 FPS: the soundtrack advances 200 ms per 200 ms frame.
  let media = 0;
  for (let i = 0; i < 60; i++) {
    media += 0.2;
    sample(media, true, 0.2);
  }
  assert.equal(resets, 1, '6 FPS playback keeps every voice');
  assert.equal(hushes, 0);
  media += 0.43;
  sample(media, true, 0.43);
  assert.equal(resets, 1, 'a 430 ms frame does not cut the audio');
  sample(media + 5, true, 0.016);
  assert.equal(resets, 2, 'a forward seek resets');
  sample(media + 2, true, 0.016);
  assert.equal(resets, 3, 'a backward seek resets');
  sample(media + 2, false, 0.016);
  assert.equal(resets, 4, 'pausing resets');
  assert.equal(hushes, 1, 'and hushes the voices');
  sample(media + 10, false, 3);
  assert.equal(resets, 5, 'a paused scrub resets regardless of how long it took');
});
