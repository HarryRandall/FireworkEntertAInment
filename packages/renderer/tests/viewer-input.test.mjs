/** Shared Space routing and gesture click suppression are exercised without mounting WebGL. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { viewerInput } from '../src/view/viewer-input.ts';
class Surface extends EventTarget {
  focus() {
    document.activeElement = this;
  }
  closest() {
    return null;
  }
}
function dispatch(target, type, options = {}) {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, {
    pointerId: 1,
    clientX: 0,
    clientY: 0,
    button: 0,
    shiftKey: false,
    ...options,
  });
  target.dispatchEvent(event);
  return event;
}
test('last-clicked Space ignores inputs, buttons, repeats and modifiers, and unregisters on disposal', () => {
  const previous = globalThis.document;
  globalThis.document = new Surface();
  document.activeElement = null;
  const first = new Surface();
  const second = new Surface();
  let firstToggles = 0;
  let secondToggles = 0;
  const offFirst = viewerInput({ toggle: () => firstToggles++ }, first, first, true);
  const offSecond = viewerInput({ toggle: () => secondToggles++ }, second, second, false);
  try {
    dispatch(first, 'pointerdown');
    dispatch(first, 'pointerup');
    assert.equal(firstToggles, 1);
    dispatch(second, 'pointerdown');
    dispatch(second, 'pointerup');
    const space = dispatch(document, 'keydown', { code: 'Space' });
    assert.equal(space.defaultPrevented, true);
    assert.equal(secondToggles, 1);
    for (const options of [
      { repeat: true },
      { metaKey: true },
      { ctrlKey: true },
      { altKey: true },
    ])
      dispatch(document, 'keydown', { code: 'Space', ...options });
    document.activeElement = { closest: () => ({}) };
    dispatch(document, 'keydown', { code: 'Space' });
    assert.equal(secondToggles, 1);
    offSecond();
    document.activeElement = null;
    dispatch(document, 'keydown', { code: 'Space' });
    assert.equal(firstToggles, 2);
    offFirst();
    dispatch(document, 'keydown', { code: 'Space' });
    assert.equal(firstToggles, 2);
  } finally {
    offFirst();
    offSecond();
    globalThis.document = previous;
  }
});
test('dragging away and back, multi-touch, secondary click and cancellation never toggle playback', () => {
  const previous = globalThis.document;
  globalThis.document = new Surface();
  const canvas = new Surface();
  let toggles = 0;
  const cleanup = viewerInput({ toggle: () => toggles++ }, canvas, canvas, true);
  try {
    dispatch(canvas, 'pointerdown');
    dispatch(canvas, 'pointermove', { clientX: 40 });
    dispatch(canvas, 'pointermove');
    dispatch(canvas, 'pointerup');
    dispatch(canvas, 'pointerdown');
    dispatch(canvas, 'pointerdown', { pointerId: 2 });
    dispatch(canvas, 'pointerup', { pointerId: 2 });
    dispatch(canvas, 'pointerup');
    dispatch(canvas, 'pointerdown', { button: 2 });
    dispatch(canvas, 'pointerup', { button: 2 });
    dispatch(canvas, 'pointerdown');
    dispatch(canvas, 'pointercancel');
    dispatch(canvas, 'pointerup');
    dispatch(canvas, 'pointerdown', { shiftKey: true });
    dispatch(canvas, 'pointerup');
    assert.equal(toggles, 0);
    dispatch(canvas, 'pointerdown');
    dispatch(canvas, 'pointerup');
    assert.equal(toggles, 1);
    cleanup();
    dispatch(canvas, 'pointerdown');
    dispatch(canvas, 'pointerup');
    assert.equal(toggles, 1);
  } finally {
    cleanup();
    globalThis.document = previous;
  }
});

test('canvas mount clips bordered hosts at every DPR and restores only owned styles', async () => {
  const { mountViewerSurface } = await import('../src/view/viewer-input.ts');
  const saved = globalThis.getComputedStyle;
  globalThis.getComputedStyle = () => ({ position: 'static', borderRadius: '0px' });
  try {
    for (const dpr of [1, 1.5, 2, 3]) {
      const host = {
        style: { position: '', overflow: '', borderRadius: '', isolation: '' },
        append(canvas) {
          this.canvas = canvas;
        },
      };
      const canvas = {
        style: {},
        width: Math.round(319.5 * dpr),
        height: Math.round(199.5 * dpr),
        setAttribute() {},
      };
      const cleanup = mountViewerSurface(host, canvas);
      assert.deepEqual(host.style, {
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 'inherit',
        isolation: 'isolate',
      });
      assert.match(canvas.style.cssText, /position:absolute;inset:0/);
      assert.match(canvas.style.cssText, /width:100%;height:100%/);
      assert.match(canvas.style.cssText, /box-sizing:border-box/);
      assert.equal(canvas.width, Math.round(319.5 * dpr));
      host.style.position = 'fixed';
      cleanup();
      assert.deepEqual(host.style, {
        position: 'fixed',
        overflow: '',
        borderRadius: '',
        isolation: '',
      });
    }
  } finally {
    globalThis.getComputedStyle = saved;
  }
});
