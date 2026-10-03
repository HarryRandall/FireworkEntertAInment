/** Native transport regressions use synchronous viewer notifications without a WebGL context. */
import test from 'node:test';
import { Element } from './viewer-dom.mjs';
import assert from 'node:assert/strict';
import { buildPlayer } from '../src/view/player.ts';
import { Viewer } from '../src/view/viewer.ts';
import { viewerInput } from '../src/view/viewer-input.ts';
import { SETTINGS } from '../src/view/settings.ts';

// Fixed show instants, duration and observation step, in seconds.
const REVIEW_TIME_S = 2.2;
const FINALE_TIME_S = 14;
const DURATION_S = 25;
const FRAME_STEP_S = 0.02;
function dispatch(element, name, properties = {}) {
  const event = new Event(name, { cancelable: true });
  Object.assign(event, properties);
  element.dispatchEvent(event);
  return event;
}
function mount() {
  const previousWindow = globalThis.window;
  const window = new EventTarget();
  window.localStorage = { getItem: () => null, setItem() {} };
  globalThis.window = window;
  const previousDocument = globalThis.document;
  const previousInput = globalThis.HTMLInputElement;
  globalThis.document = new Element('document');
  document.createElement = (tag) => new Element(tag);
  document.activeElement = null;
  globalThis.HTMLInputElement = Element;
  const viewer = Object.create(Viewer.prototype);
  Object.assign(viewer, {
    container: new Element('div'),
    listeners: new Set(),
    disposed: false,
    duration: DURATION_S,
    t: 0,
    last: 0,
    speed: 1,
    playing: false,
    sound: { reset() {}, hush() {} },
    schedule() {},
    cancelFrame() {
      this.sound.hush();
    },
    controls: { stop() {} },
    invalidate() {},
    resetCamera() {},
  });
  const cleanup = buildPlayer(viewer);
  return {
    viewer,
    find: (label) => viewer.container.find((element) => element.textContent === label),
    range: viewer.container.find(
      (element) => element.attributes.get('aria-label') === 'Preview time',
    ),
    cleanup() {
      cleanup();
      globalThis.window = previousWindow;
      globalThis.document = previousDocument;
      globalThis.HTMLInputElement = previousInput;
    },
  };
}
function advance(viewer) {
  // The frame loop advances the sequence only while playing; use its real advancement method.
  if (viewer.playing) viewer.advancePlayback(FRAME_STEP_S);
}
for (const playing of [false, true]) {
  test(`unfocused native input captures requested seconds before pause notifications, playing=${playing}`, () => {
    const rig = mount();
    try {
      rig.viewer.seek(REVIEW_TIME_S);
      if (playing) rig.viewer.play();
      rig.range.value = String(FINALE_TIME_S);
      dispatch(rig.range, 'input');
      assert.equal(rig.viewer.t, FINALE_TIME_S);
      assert.equal(rig.range.value, String(FINALE_TIME_S));
      assert.equal(rig.viewer.playing, false);
      advance(rig.viewer);
      assert.equal(rig.viewer.t, FINALE_TIME_S);
      assert.ok(rig.find('Play'));
      rig.range.value = String(REVIEW_TIME_S);
      dispatch(rig.range, 'input');
      assert.equal(rig.viewer.t, REVIEW_TIME_S);
      assert.equal(rig.range.value, String(REVIEW_TIME_S));
    } finally {
      rig.cleanup();
    }
  });
}
test('pause and native scrubbing retain sub-step show seconds; keyboard nudges stay precise', () => {
  const rig = mount();
  const exactTime = 0.017602142;
  try {
    assert.equal(rig.range.step, 'any');
    rig.viewer.play();
    rig.viewer.t = exactTime;
    rig.viewer.emit();
    dispatch(rig.find('Pause'), 'click');
    assert.equal(rig.viewer.t, exactTime);
    assert.equal(Number(rig.range.value), exactTime);
    rig.range.value = '2.205142857';
    dispatch(rig.range, 'input');
    assert.equal(rig.viewer.t, 2.205142857);
    rig.range.focus();
    dispatch(rig.range, 'keydown', { key: 'ArrowRight' });
    assert.equal(rig.viewer.t, 2.205142857 + 0.01);
    assert.equal(Number(rig.range.value), rig.viewer.t);
    assert.equal(rig.viewer.playing, false);
  } finally {
    rig.cleanup();
  }
});
test('Pause, seeks, settings and speed preserve paused state; Restart deliberately plays', () => {
  const rig = mount();
  const canvas = new Element('canvas');
  const cleanupInput = viewerInput(rig.viewer, rig.viewer.container, canvas, true);
  try {
    dispatch(rig.find('Play'), 'click');
    assert.equal(rig.viewer.playing, true);
    const button = rig.find('Pause');
    button.focus();
    dispatch(button, 'click');
    assert.equal(rig.viewer.playing, false);
    assert.equal(document.activeElement, rig.find('Play'));
    // The document handler leaves Space on native controls to their default activation.
    dispatch(document, 'keydown', { code: 'Space' });
    assert.equal(rig.viewer.playing, false);
    rig.viewer.seek(FINALE_TIME_S);
    advance(rig.viewer);
    assert.equal(rig.viewer.t, FINALE_TIME_S);
    dispatch(rig.find('Settings'), 'click');
    dispatch(rig.find('Reset view'), 'click');
    rig.viewer.setSpeed(0.25);
    assert.equal(rig.viewer.playing, false);
    dispatch(rig.find('Restart'), 'click');
    assert.equal(rig.viewer.playing, true);
    assert.equal(rig.viewer.t, 0);
    assert.equal(rig.find('Pause'), button, 'Native activation retains the focused DOM button');
  } finally {
    cleanupInput();
    rig.cleanup();
  }
});

test('native sound controls share mute and volume preferences without changing paused playback', () => {
  const saved = { ...SETTINGS };
  const rig = mount();
  try {
    SETTINGS.sound = false;
    // Use the existing label from default-mute settings so activation also paints the new label.
    dispatch(rig.find('Unmute'), 'click');
    assert.equal(SETTINGS.sound, true);
    assert.ok(rig.find('Mute'));
    assert.equal(rig.viewer.playing, false);
    const volume = rig.viewer.container.find(
      (element) => element.attributes.get('aria-label') === 'Sound volume',
    );
    volume.value = '0.2';
    dispatch(volume, 'input');
    assert.equal(SETTINGS.volume, 0.2);
    dispatch(rig.find('Mute'), 'click');
    assert.equal(SETTINGS.sound, false);
    assert.equal(SETTINGS.volume, 0.2);
    assert.equal(rig.viewer.playing, false);
  } finally {
    rig.cleanup();
    Object.assign(SETTINGS, saved);
  }
});
