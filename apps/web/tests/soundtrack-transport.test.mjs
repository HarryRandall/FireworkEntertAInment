/** Audio-clock transport tests use synthetic media and a viewer without WebGL. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { soundtrackTransport } from '../ui/shopper/soundtrack-transport.ts';
class Audio extends EventTarget {
  currentTime = 0;
  paused = true;
  ended = false;
  reject = false;
  loadCount = 0;
  async play() {
    if (this.reject) throw new Error('blocked');
    this.paused = false;
  }
  pause() {
    this.paused = true;
  }
  removeAttribute() {}
  load() {
    this.loadCount += 1;
  }
}
class Viewer {
  t = 4;
  duration = 120;
  playing = false;
  listeners = new Set();
  emit() {
    for (const listener of this.listeners) listener(this);
  }
  play() {
    if (this.t >= this.duration) this.t = 0;
    this.playing = true;
    this.emit();
  }
  pause() {
    this.playing = false;
    this.emit();
  }
  seek(time) {
    this.t = time;
    this.emit();
  }
  on(listener) {
    this.listeners.add(listener);
    listener(this);
    return () => this.listeners.delete(listener);
  }
}
test('play, pause, seek, restart and drift use the same clock', async () => {
  const viewer = new Viewer();
  const audio = new Audio();
  const transport = soundtrackTransport(viewer, audio, () => assert.fail('unexpected audio error'));
  await transport.toggle();
  assert.equal(audio.currentTime, 4);
  assert.equal(viewer.playing, true);
  audio.currentTime = 5;
  viewer.t = 5.5;
  viewer.emit();
  assert.equal(viewer.t, 5);
  transport.seek(8);
  assert.equal(audio.currentTime, 8);
  assert.equal(viewer.t, 8);
  await transport.toggle();
  assert.equal(audio.paused, true);
  assert.equal(viewer.playing, false);
  viewer.t = viewer.duration;
  await transport.toggle();
  assert.equal(viewer.t, 0);
  assert.equal(audio.currentTime, 0);
  transport.dispose();
  assert.equal(viewer.listeners.size, 0);
  assert.equal(audio.paused, true);
  assert.equal(audio.loadCount, 1);
});
test('buffering stops the viewer, resumes on readiness and pauses at audio end', async () => {
  const viewer = new Viewer();
  const audio = new Audio();
  const transport = soundtrackTransport(viewer, audio, () => {});
  await transport.toggle();
  audio.dispatchEvent(new Event('waiting'));
  assert.equal(viewer.playing, false);
  assert.equal(audio.paused, false);
  audio.dispatchEvent(new Event('canplay'));
  assert.equal(viewer.playing, true);
  audio.dispatchEvent(new Event('ended'));
  assert.equal(viewer.playing, false);
  transport.dispose();
  audio.dispatchEvent(new Event('canplay'));
  assert.equal(viewer.playing, false);
});
test('autoplay rejection is visible and leaves both transports paused', async () => {
  const viewer = new Viewer();
  const audio = new Audio();
  audio.reject = true;
  let failures = 0;
  const transport = soundtrackTransport(viewer, audio, () => {
    failures += 1;
  });
  await transport.toggle();
  assert.equal(failures, 1);
  assert.equal(viewer.playing, false);
  assert.equal(audio.paused, true);
  transport.dispose();
});
test('dispose while play is pending prevents stale playback from starting', async () => {
  const viewer = new Viewer();
  const audio = new Audio();
  let release;
  audio.play = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  const transport = soundtrackTransport(viewer, audio, () => {});
  const pending = transport.toggle();
  transport.dispose();
  release();
  await pending;
  assert.equal(viewer.playing, false);
  assert.equal(audio.paused, true);
});
test('saved offsets trim audio or leave a silent introduction and retain seek clocks', async () => {
  const viewer = new Viewer();
  const audio = new Audio();
  const transport = soundtrackTransport(viewer, audio, () => {}, 2);
  await transport.toggle();
  assert.equal(audio.currentTime, 6);
  transport.seek(10);
  assert.equal(audio.currentTime, 12);
  assert.equal(viewer.t, 10);
  audio.currentTime = 13;
  viewer.t = 12;
  viewer.emit();
  assert.equal(viewer.t, 11);
  transport.dispose();
  const delayed = new Viewer();
  delayed.t = 0;
  const delayedAudio = new Audio();
  const delay = soundtrackTransport(delayed, delayedAudio, () => {}, -2);
  await delay.toggle();
  assert.equal(delayed.playing, true);
  assert.equal(delayedAudio.paused, true);
  delayed.t = 2;
  delayed.emit();
  await Promise.resolve();
  assert.equal(delayedAudio.paused, false);
  assert.equal(delayedAudio.currentTime, 0);
  delay.dispose();
});
test('a second click cancels a pending audio start and external viewer play starts audio', async () => {
  const viewer = new Viewer();
  const audio = new Audio();
  let release;
  audio.play = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  const transport = soundtrackTransport(viewer, audio, () => {});
  const pending = transport.toggle();
  await transport.toggle();
  release();
  await pending;
  assert.equal(viewer.playing, false);
  transport.dispose();
  const keyboardViewer = new Viewer();
  const keyboardAudio = new Audio();
  const keyboard = soundtrackTransport(keyboardViewer, keyboardAudio, () => {});
  keyboardViewer.play();
  await Promise.resolve();
  assert.equal(keyboardAudio.paused, false);
  assert.equal(keyboardAudio.currentTime, keyboardViewer.t);
  keyboard.dispose();
});
