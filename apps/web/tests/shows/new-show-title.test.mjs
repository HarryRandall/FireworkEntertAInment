import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deriveShowTitle } from '../../app/(app)/shows/new/utils.ts';

test('cancelling or replacing a song derives the title from the current selection', () => {
  const description = 'a golden birthday finale';
  assert.equal(
    deriveShowTitle({ description, trackTitle: 'In Tune (J. Glaze Remix)' }),
    'In Tune (J. Glaze Remix)',
  );
  assert.equal(deriveShowTitle({ description }), 'A golden birthday finale');
  assert.equal(
    deriveShowTitle({ description, filename: 'katy-perry-firework.mp3' }),
    'Katy Perry Firework',
  );
  assert.equal(deriveShowTitle({ description, trackTitle: 'Breathe' }), 'Breathe');
});

test('uploaded songs retain their title once the pending selection has finished', () => {
  assert.equal(deriveShowTitle({ description: '', filename: 'my_track.mp3' }), 'My Track');
  assert.equal(
    deriveShowTitle({ description: '', trackTitle: 'In Tune', filename: 'provider-file.mp3' }),
    'In Tune',
  );
  assert.equal(deriveShowTitle({ description: '', filename: '.mp3' }), 'Untitled show');
});
