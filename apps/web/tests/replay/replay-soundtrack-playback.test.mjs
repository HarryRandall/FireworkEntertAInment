/** Static guards for browser-activated soundtrack playback in show replay. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const viewer = readFileSync(join(root, 'ui/replay/FireworkReplayViewer.tsx'), 'utf8');
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

test('Play and Pause act on the transport synchronously from the click, never from an effect', () => {
  const togglePlayback = between(viewer, 'function togglePlayback()', 'function startPlayback()');
  const startPlayback = between(viewer, 'function startPlayback()', 'function restart()');
  const pausePlayback = between(viewer, 'function pausePlayback(', 'function togglePlayback()');

  assert.match(togglePlayback, /if \(wantsPlayback\(\)\) \{\s*pausePlayback\(\);\s*return;/);
  assert.match(togglePlayback, /startPlayback\(\);/);
  assert.match(startPlayback, /void soundtrack\.play\(elapsedRef\.current\)/);
  assert.match(startPlayback, /if \(started\) setIsPlaying\(true\);/);
  assert.match(pausePlayback, /soundtrack\.pause\(\);[\s\S]*freezeAt\(timeSeconds\);/);

  // Every effect body: none may touch the media transport, because an effect
  // runs after the click that follows it and would cancel that click's Play.
  const effectBodies = viewer.split(/use(?:Layout)?Effect\(\(\) => \{/).slice(1);
  assert.ok(effectBodies.length > 5);
  for (const body of effectBodies) {
    const scope = body
      .slice(0, body.search(/\n  \}(?:, \[|\);)/))
      // The frame loop stopping at the end of the show is the clock itself,
      // not a reaction to React state; it is allowed.
      .replace(/function tick\(now: number\) \{[\s\S]*?\n {4}\}\n/, '');
    assert.doesNotMatch(scope, /soundtrack\.(pause|play)\(/);
    assert.doesNotMatch(scope, /setIsPlaying\(false\)/);
  }
});

test('soundtrack shows take their clock from the media and stop with it', () => {
  const tick = between(
    viewer,
    'function tick(now: number)',
    'frame = requestAnimationFrame(tick);',
  );

  const soundtrackBranch = between(tick, 'if (hasSoundtrack) {', '} else {');
  assert.match(soundtrackBranch, /soundtrack\.sample\(\)/);
  assert.match(soundtrackBranch, /clock\.state === 'interrupted'\) return;/);
  assert.match(soundtrackBranch, /next = Math\.min\(duration, clock\.time\);/);
  assert.doesNotMatch(soundtrackBranch, /dtFromStart|frameGap|\?\?/);
  assert.doesNotMatch(viewer, /audioClockLost|carries on without/);
  assert.match(viewer, /soundtrackInterruptionMessage\(interruption\.reason\)/);
  assert.match(viewer, /action: \{ label: 'Play', onClick: \(\) => startPlayback\(\) \}/);
  assert.match(viewer, /<audio[\s\S]*key=\{audioUrl\}[\s\S]*ref=\{attachSoundtrack\}/);
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

  assert.match(restart, /if \(wantsPlayback\(\)\) \{[\s\S]*seekTo\(0, true\);[\s\S]*return;/);
  assert.match(restart, /seekTo\(0, false\);[\s\S]*startPlayback\(\);/);
  assert.doesNotMatch(restart, /setIsPlaying\(false\)/);
});
