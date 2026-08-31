import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildBeatMoments,
  launchPositionCountForSlots,
} from '../lib/cue-generation/beat-sync-moments.ts';

const direction = {
  style: 'beat_test',
  density: 'balanced',
  precise: true,
  surprise: false,
  quietMiddle: false,
  softEnding: false,
  bigEnding: false,
};

function slot(overrides) {
  return {
    index: 0,
    time: 10,
    tube: 0,
    intensity: 0.8,
    sectionLabel: 'Chorus 1',
    vibe: 'chorus',
    nearClimax: false,
    isDownbeat: true,
    barPosition: 0,
    emphasis: 'accent',
    finale: false,
    ...overrides,
  };
}

test('a chorus beat becomes one simultaneous three-tube musical moment', () => {
  const slots = [
    slot({ index: 20, tube: 0 }),
    slot({ index: 21, tube: 1 }),
    slot({ index: 22, tube: 2, emphasis: 'peak', nearClimax: true }),
  ];

  const moments = buildBeatMoments({ slots, songDuration: 180, direction });

  assert.equal(moments.length, 1);
  assert.deepEqual(moments[0].tubes, [0, 1, 2]);
  assert.deepEqual(moments[0].slotIndices, [20, 21, 22]);
  assert.equal(moments[0].time, 10);
  assert.equal(moments[0].emphasis, 'peak');
  assert.equal(moments[0].nearClimax, true);
});

test('section occurrences expose one boundary for each repeated chorus', () => {
  const slots = [
    slot({ index: 0, time: 10, sectionLabel: 'Chorus' }),
    slot({ index: 1, time: 11, sectionLabel: 'Chorus' }),
    slot({ index: 2, time: 20, sectionLabel: 'Verse', vibe: 'verse' }),
    slot({ index: 3, time: 30, sectionLabel: 'Chorus' }),
  ];

  const moments = buildBeatMoments({ slots, songDuration: 180, direction });

  assert.deepEqual(
    moments.map((moment) => moment.isSectionStart),
    [true, false, true, true],
  );
  assert.notEqual(moments[0].sectionKey, moments[3].sectionKey);
});

test('available launch-position count uses the widest requested tube', () => {
  assert.equal(launchPositionCountForSlots([]), 1);
  assert.equal(launchPositionCountForSlots([slot({ tube: 0 })]), 1);
  assert.equal(launchPositionCountForSlots([slot({ tube: 0 }), slot({ tube: 1 })]), 2);
  assert.equal(
    launchPositionCountForSlots([slot({ tube: 0 }), slot({ tube: 1 }), slot({ tube: 2 })]),
    3,
  );
});

test('quiet-middle filtering preserves a protected climax group intact', () => {
  const slots = [
    slot({ index: 0, time: 50, tube: 0, vibe: 'verse', sectionLabel: 'Verse' }),
    slot({ index: 1, time: 50, tube: 1, vibe: 'verse', sectionLabel: 'Verse' }),
    slot({ index: 2, time: 50, tube: 2, vibe: 'verse', sectionLabel: 'Verse' }),
    slot({ index: 3, time: 60, tube: 0, nearClimax: true }),
    slot({ index: 4, time: 60, tube: 1, nearClimax: true }),
    slot({ index: 5, time: 60, tube: 2, nearClimax: true }),
  ];

  const moments = buildBeatMoments({
    slots,
    songDuration: 120,
    direction: { ...direction, quietMiddle: true },
  });

  assert.deepEqual(
    moments.map((moment) => moment.time),
    [50, 60],
  );
  assert.deepEqual(moments[1].tubes, [0, 1, 2]);
});
