/** Live/poster framing and acoustic shake stay pure and deterministic. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { framingFor, EYE_HEIGHT_M } from '../src/sim/framing.ts';
import { shakeAt, shakeEvents, soundLag } from '../src/sim/shake.ts';
import { effectTemplates } from '../src/templates/index.ts';
const template = (key) => effectTemplates.find((entry) => entry.key === key).design;
const peony = template('peony');
test('live framing starts at audience height and widens for portrait finales', () => {
  const shots = [
    { design: peony, position: [-40, 0] },
    { design: peony, position: [40, 0] },
  ];
  const wide = framingFor(shots, false, 1.6);
  const narrow = framingFor(shots, false, 390 / 844);
  assert.equal(wide.position[1], EYE_HEIGHT_M);
  assert.deepEqual(wide.target, wide.focus.target);
  assert.equal(wide.target[1], peony.launch.height_m);
  assert.deepEqual(narrow.target, narrow.focus.target);
  assert.ok(narrow.position[2] > wide.position[2]);
  const poster = framingFor([{ design: peony }], true);
  assert.equal(poster.target[1], peony.launch.height_m);
  assert.equal(poster.position[1], peony.launch.height_m * 0.55);
  for (const entry of effectTemplates) {
    for (const tight of [true, false]) {
      const frame = framingFor([{ design: entry.design }], tight, 390 / 844);
      assert.ok([...frame.position, ...frame.target].every(Number.isFinite), entry.key);
    }
  }
  assert.throws(() => framingFor(shots, false, 0), RangeError);
});
test('large booms shake only after acoustic arrival and replay without accumulated state', () => {
  const events = shakeEvents([{ design: peony, t0: 2, position: [10, 0] }]);
  assert.ok(events.length > 0);
  const camera = [10, peony.launch.height_m, 80];
  const out = [0, 0, 0];
  const event = events[0];
  assert.deepEqual(shakeAt(events, event.time_s, camera, out), [0, 0, 0]);
  const time = event.time_s + soundLag(80) + 0.08;
  const first = [...shakeAt(events, time, camera, out)];
  assert.ok(first.some((angle) => Math.abs(angle) > 0));
  shakeAt(events, time + 2, camera, out);
  assert.deepEqual(shakeAt(events, time, camera, out), first);
  assert.deepEqual(shakeAt(events, time + 3, camera, out), [0, 0, 0]);
  assert.equal(soundLag(343), 1);
  assert.equal(soundLag(3430), 1.5);
  assert.deepEqual(shakeEvents([{ design: template('fountain') }]), []);
});
