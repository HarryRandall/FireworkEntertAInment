import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  requestSoundtrackPlayback,
  resolveReplayRestart,
  resolveReplayScrubCommit,
} from '../lib/replay-transport.ts';

test('soundtrack play is requested synchronously and visual playback waits for readiness', async () => {
  let resolvePlay;
  let playCalls = 0;
  const audio = {
    currentTime: 0,
    play() {
      playCalls += 1;
      return new Promise((resolve) => {
        resolvePlay = resolve;
      });
    },
  };

  const pending = requestSoundtrackPlayback({ audio, targetTimeSeconds: 12 });
  assert.equal(playCalls, 1, 'play() must run in the interaction call stack');
  assert.equal(audio.currentTime, 12);

  let settled = false;
  void pending.then(() => {
    settled = true;
  });
  await Promise.resolve();
  assert.equal(settled, false, 'visual playback must wait while audio is not ready');
  resolvePlay();
  assert.deepEqual(await pending, { status: 'started' });
});

test('soundtrack play rejection remains a retryable paused outcome', async () => {
  const denied = new Error('NotAllowedError');
  const result = await requestSoundtrackPlayback({
    audio: { currentTime: 5, play: () => Promise.reject(denied) },
    targetTimeSeconds: 5,
  });

  assert.deepEqual(result, { status: 'rejected', error: denied });
});

test('restart keeps active audio running and starts paused audio after seeking', () => {
  assert.deepEqual(resolveReplayRestart(true), {
    continuePlaying: true,
    startAfterSeek: false,
  });
  assert.deepEqual(resolveReplayRestart(false), {
    continuePlaying: false,
    startAfterSeek: true,
  });
});

test('scrubbing preserves a running soundtrack and visual clock', () => {
  assert.deepEqual(
    resolveReplayScrubCommit({ pendingTimeSeconds: 42, durationSeconds: 90, isPlaying: true }),
    { timeSeconds: 42, continuePlaying: true },
  );
});

test('scrubbing remains paused and clamps to the replay duration', () => {
  assert.deepEqual(
    resolveReplayScrubCommit({ pendingTimeSeconds: 100, durationSeconds: 90, isPlaying: false }),
    { timeSeconds: 90, continuePlaying: false },
  );
});
