/** Pointer and keyboard scrubs both end, in the order Radix Slider reports them. */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createScrubGesture } from '../../ui/replay/scrub-gesture.ts';

/** The transport control's slider wiring around the machine. */
function slider() {
  const log = [];
  const gesture = createScrubGesture();
  const end = () => log.push(['end']);
  return {
    log,
    gesture,
    // Radix onValueChange
    change(seconds) {
      log.push(['scrub', seconds]);
      if (gesture.change()) end();
    },
    // Radix onValueCommit
    commit() {
      if (gesture.commit()) end();
    },
    jump(seconds) {
      log.push(['scrub', seconds]);
      if (gesture.jump()) end();
    },
    blur() {
      if (gesture.leave()) end();
    },
  };
}

test('a pointer drag scrubs on every move and ends once on release', () => {
  const s = slider();
  s.change(10);
  s.change(11);
  assert.equal(s.gesture.active, true);
  s.change(12);
  s.commit();
  assert.equal(s.gesture.active, false);
  assert.deepEqual(s.log, [['scrub', 10], ['scrub', 11], ['scrub', 12], ['end']]);
});

test('Home/End and arrow keys, which commit before they change, still end the gesture', () => {
  const s = slider();
  // Radix fires onValueCommit from inside its value updater, then onValueChange.
  s.commit();
  assert.equal(s.gesture.active, false, 'a commit with nothing in flight is not a gesture');
  s.change(0);
  assert.equal(s.gesture.active, false, 'the change that follows completes it');
  assert.deepEqual(s.log, [['scrub', 0], ['end']]);

  s.commit();
  s.change(75);
  assert.deepEqual(s.log.slice(2), [['scrub', 75], ['end']]);
});

test('a keyboard step does not leave the pointer drag that follows it half finished', () => {
  const s = slider();
  s.commit();
  s.change(5);
  s.change(20);
  s.change(21);
  assert.equal(s.gesture.active, true, 'the drag is its own gesture');
  s.commit();
  assert.deepEqual(s.log, [['scrub', 5], ['end'], ['scrub', 20], ['scrub', 21], ['end']]);
});

test('a tick jump is a complete gesture on its own', () => {
  const s = slider();
  s.jump(42);
  assert.equal(s.gesture.active, false);
  assert.deepEqual(s.log, [['scrub', 42], ['end']]);
});

test('focus leaving mid-drag ends the gesture; leaving when idle does nothing', () => {
  const s = slider();
  s.blur();
  s.change(8);
  s.blur();
  assert.equal(s.gesture.active, false);
  assert.deepEqual(s.log, [['scrub', 8], ['end']]);
});
