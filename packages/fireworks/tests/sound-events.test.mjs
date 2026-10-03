/** Acoustic determinism and independently captured prototype cue parity without browser globals. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { soundEvents, soundDistance } from '../src/sim/events.ts';
import { effectTemplates } from '../src/templates/index.ts';
import { reviewFixtureDesign } from '../src/fixtures/index.ts';
import { resolveDesign } from '../src/schema/index.ts';
const golden = JSON.parse(readFileSync(new URL('./fixtures/sound-goldens.json', import.meta.url)));
const TOLERANCE = 1e-9;
function compare(actual, expected) {
  const { seed, distance_m: actualDistance, ...cue } = actual;
  assert.ok(Number.isInteger(seed) && seed >= 0 && seed < 2 ** 32);
  const { distance_m, ...expectedCue } = expected;
  for (const key of ['time_s', 'size', 'duration_s']) {
    assert.ok(Math.abs(cue[key] - expectedCue[key]) < TOLERANCE, key);
    delete cue[key];
    delete expectedCue[key];
  }
  assert.deepEqual(cue, expectedCue);
  assert.ok(Math.abs(actualDistance - distance_m) < TOLERANCE);
  assert.ok(Math.abs(soundDistance(actual, golden.listener) - distance_m) < TOLERANCE);
}
for (const reference of golden.templates) {
  test(`sound cues match the prototype: ${reference.key}`, () => {
    const design = effectTemplates.find((template) => template.key === reference.key).design;
    const events = soundEvents([{ design }], golden.listener);
    assert.equal(events.length, reference.events.length);
    events.forEach((event, index) => compare(event, reference.events[index]));
  });
}
for (const key of ['peony', 'comet', 'multi-break']) {
  test(`fixture events are deterministic, positioned and seeded: ${key}`, () => {
    const design = reviewFixtureDesign(key);
    const before = structuredClone(design);
    const shots = [{ design, t0: 3, position: [7, -4], seed: 0 }];
    const events = soundEvents(shots);
    assert.deepEqual(soundEvents(shots), events);
    assert.deepEqual(design, before);
    const local = soundEvents([{ design, seed: 0 }]);
    events.forEach((event, index) => {
      assert.equal(event.time_s, local[index].time_s + 3);
      assert.deepEqual(event.position, [
        local[index].position[0] + 7,
        local[index].position[1],
        local[index].position[2] - 4,
      ]);
      assert.equal(event.seed, local[index].seed);
    });
    assert.notDeepEqual(
      soundEvents([{ ...shots[0], seed: 1 }]).map((e) => e.seed),
      events.map((e) => e.seed),
    );
  });
}
test('resolved adjustments and multiple modifiers affect cues without mutating designs', () => {
  const design = reviewFixtureDesign('peony');
  design.adjustments = { 'launch.height': 2 };
  const layer = design.breaks[0].layers[0];
  const modifier = { kind: 'crackle', at: 0.7, amount: 1, rate: 12, count: 14 };
  layer.modifiers = [modifier, { ...modifier, kind: 'pop' }, { ...modifier, kind: 'strobe' }];
  const events = soundEvents([{ design }]);
  assert.equal(events.filter((e) => e.kind === 'crackle').length, 2);
  assert.equal(events.find((e) => e.kind === 'crackle').heavy, true);
  assert.ok(events.some((e) => e.kind === 'hiss'));
  const boom = events.find((e) => e.kind === 'boom');
  assert.equal(boom.position[1], resolveDesign(design).launch.height_m + layer.offset_m[1]);
});

test('whistle launch cues retain prototype playback even with the stored default whistle gain', () => {
  const design = reviewFixtureDesign('peony');
  design.launch.tail = 'whistle';
  assert.equal(design.sound.whistle, 0);
  assert.ok(soundEvents([{ design }]).some((event) => event.kind === 'whistle'));
});
