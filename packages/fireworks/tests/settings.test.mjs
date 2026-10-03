/** Browser preference validation, shared notifications and persistence failures stay visible. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { SETTINGS, setSetting, onSettings } from '../src/view/settings.ts';
test('settings load only known booleans, notify mounted views, persist and clean up storage listeners', () => {
  const previousWindow = globalThis.window;
  const warn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args);
  const storage = new Map([
    [
      'sc-viewer-settings',
      JSON.stringify({ smoke: false, free: true, stats: 'wrong', unknown: true }),
    ],
  ]);
  const window = new EventTarget();
  window.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  };
  globalThis.window = window;
  let first = 0;
  let second = 0;
  const offFirst = onSettings(() => first++);
  const offSecond = onSettings(() => second++);
  try {
    assert.equal(SETTINGS.smoke, false);
    assert.equal(SETTINGS.free, true);
    assert.equal(SETTINGS.stats, false);
    assert.equal('unknown' in SETTINGS, false);
    setSetting('grid', false);
    assert.equal(first, 2);
    assert.equal(second, 2);
    assert.equal(JSON.parse(storage.get('sc-viewer-settings')).grid, false);
    const update = new Event('storage');
    Object.assign(update, {
      key: 'sc-viewer-settings',
      newValue: JSON.stringify({ shake: false }),
    });
    window.dispatchEvent(update);
    assert.equal(SETTINGS.shake, false);
    assert.equal(SETTINGS.smoke, true, 'missing preferences return to defaults');
    const malformed = new Event('storage');
    Object.assign(malformed, { key: 'sc-viewer-settings', newValue: '{bad json' });
    window.dispatchEvent(malformed);
    assert.equal(SETTINGS.shake, false, 'corruption retains the last valid preference');
    window.localStorage.setItem = () => {
      throw new Error('storage denied');
    };
    setSetting('shake', true);
    assert.equal(SETTINGS.shake, true);
    assert.equal(warnings.length, 3, 'invalid input and storage failures remain visible');
    offFirst();
    offSecond();
    const count = first;
    window.dispatchEvent(update);
    assert.equal(first, count);
  } finally {
    offFirst();
    offSecond();
    console.warn = warn;
    globalThis.window = previousWindow;
  }
});
