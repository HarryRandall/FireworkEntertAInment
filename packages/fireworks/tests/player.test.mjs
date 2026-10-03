/** Native transport regressions use synchronous viewer notifications without a WebGL context. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlayer } from '../src/view/player.ts';
import { Viewer } from '../src/view/viewer.ts';
import { viewerInput } from '../src/view/viewer-input.ts';

// Fixed show instants, duration and observation step, in seconds.
const REVIEW_TIME_S = 2.2;
const FINALE_TIME_S = 14;
const DURATION_S = 25;
const FRAME_STEP_S = 0.02;
class Element extends EventTarget {
  children = [];
  attributes = new Map();
  value = '';
  textContent = '';
  dataset = {};
  constructor(tag) {
    super();
    this.tag = tag;
  }
  append(...children) {
    for (const child of children) {
      if (child instanceof Element) child.parent = this;
      this.children.push(child);
    }
  }
  setAttribute(key, value) {
    this.attributes.set(key, value);
  }
  querySelectorAll() {
    return this.children.flatMap((child) =>
      child instanceof Element
        ? [...(child.dataset.setting ? [child] : []), ...child.querySelectorAll()]
        : [],
    );
  }
  closest() {
    return ['input', 'select', 'button'].includes(this.tag) ? this : null;
  }
  focus() {
    document.activeElement = this;
  }
  remove() {
    this.parent.children = this.parent.children.filter((child) => child !== this);
  }
  find(predicate) {
    if (predicate(this)) return this;
    for (const child of this.children) {
      if (!(child instanceof Element)) continue;
      const result = child.find(predicate);
      if (result) return result;
    }
  }
}
function dispatch(element, name, properties = {}) {
  const event = new Event(name, { cancelable: true });
  Object.assign(event, properties);
  element.dispatchEvent(event);
  return event;
}
function mount() {
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
    schedule() {},
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
