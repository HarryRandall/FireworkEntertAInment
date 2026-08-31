import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shouldKeepPlannedMoment } from '../../lib/cue-generation/moment-groups.ts';

test('chorus and finale accents are kept only as complete coordinated groups', () => {
  assert.equal(
    shouldKeepPlannedMoment({
      requestedTubeCount: 3,
      acceptedTubeCount: 2,
      vibe: 'chorus',
      nearClimax: false,
      finale: false,
    }),
    false,
  );
  assert.equal(
    shouldKeepPlannedMoment({
      requestedTubeCount: 3,
      acceptedTubeCount: 3,
      vibe: 'verse',
      nearClimax: false,
      finale: true,
    }),
    true,
  );
});

test('ordinary verse texture may deliberately keep a partial formation', () => {
  assert.equal(
    shouldKeepPlannedMoment({
      requestedTubeCount: 2,
      acceptedTubeCount: 1,
      vibe: 'verse',
      nearClimax: false,
      finale: false,
    }),
    true,
  );
});

test('empty moments are always discarded', () => {
  assert.equal(
    shouldKeepPlannedMoment({
      requestedTubeCount: 1,
      acceptedTubeCount: 0,
      vibe: 'verse',
      nearClimax: false,
      finale: false,
    }),
    false,
  );
});
