/** Static guards for browser-activated soundtrack playback in show replay. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const viewer = readFileSync(join(root, 'components/replay/FireworkReplayViewer.tsx'), 'utf8');
const previewPage = readFileSync(join(root, 'app/(app)/shows/[id]/preview/page.tsx'), 'utf8');

function between(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `Missing start marker: ${start}`);
  assert.notEqual(endIndex, -1, `Missing end marker: ${end}`);
  return source.slice(startIndex, endIndex);
}

test('the signed soundtrack streams independently from the firework catalogue', () => {
  assert.match(previewPage, /const fireworkSpecificationsPromise = listFireworkProducts\(\);/);
  assert.match(previewPage, /const audioUrlPromise = getAudioSignedUrl\(show\.audioPath\);/);
  assert.match(previewPage, /hasSoundtrack=\{Boolean\(show\.audioPath\)\}/);
  assert.doesNotMatch(
    previewPage,
    /Promise\.all\(\[\s*listFireworkProducts\(\),\s*getAudioSignedUrl\(show\.audioPath\)/,
  );
});

test('Play calls audio.play directly from the interaction path', () => {
  const playbackEffect = between(
    viewer,
    '// Starting audible media belongs in the user',
    '// Keep paused audio aligned with the playhead',
  );
  const togglePlayback = between(viewer, 'function togglePlayback()', 'function restart()');
  const startPlayback = between(viewer, 'function startPlayback()', 'function restart()');

  assert.doesNotMatch(playbackEffect, /audio\.play\(\)/);
  assert.match(togglePlayback, /startPlayback\(\);/);
  assert.match(startPlayback, /void audio[\s\S]*\.play\(\)/);
  assert.match(startPlayback, /\.then\(\(\) => setIsPlaying\(true\)\)/);
  assert.match(startPlayback, /soundtrack playback failed/);
});

test('soundtrack shows do not begin a silent replay before audio is ready', () => {
  const startPlayback = between(viewer, 'function startPlayback()', 'function restart()');
  const autoplay = between(
    viewer,
    "if (searchParams.get('autoplay') !== '1') return;",
    'function openCueDialog',
  );

  assert.match(startPlayback, /if \(hasSoundtrack\) \{/);
  assert.match(startPlayback, /Your soundtrack is still loading/);
  assert.match(startPlayback, /Your soundtrack could not be loaded/);
  assert.match(autoplay, /if \(hasSoundtrack\) \{[\s\S]*router\.replace[\s\S]*return;/);
});

test('Restart resets and resumes both the soundtrack and replay clock', () => {
  const restart = between(viewer, 'function restart()', 'function seekTo');

  assert.match(restart, /if \(isPlaying\) \{[\s\S]*seekTo\(0, true\);[\s\S]*return;/);
  assert.match(restart, /seekTo\(0, false\);[\s\S]*startPlayback\(\);/);
  assert.doesNotMatch(restart, /setIsPlaying\(false\)/);
});
