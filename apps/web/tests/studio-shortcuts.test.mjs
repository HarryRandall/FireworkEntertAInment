// Native text editing retains its own history.
import assert from 'node:assert/strict';
import test from 'node:test';
import { historyShortcut } from '../lib/studio/shortcuts.ts';
test('keyboard commands preserve text editing, composition and unrelated modifiers', () => {
  const event = {
    key: 'z',
    metaKey: true,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    isComposing: false,
  };
  assert.equal(historyShortcut(event, false), 'undo');
  assert.equal(historyShortcut({ ...event, shiftKey: true }, false), 'redo');
  assert.equal(
    historyShortcut({ ...event, metaKey: false, ctrlKey: true, key: 'y' }, false),
    'redo',
  );
  assert.equal(historyShortcut(event, true), null);
  assert.equal(historyShortcut({ ...event, isComposing: true }, false), null);
  assert.equal(historyShortcut({ ...event, altKey: true }, false), null);
  assert.equal(historyShortcut({ ...event, metaKey: false }, false), null);
});
