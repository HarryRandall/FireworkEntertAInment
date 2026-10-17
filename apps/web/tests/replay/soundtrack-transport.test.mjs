/** Lifecycle of the soundtrack-owned replay clock against a scripted media element. */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SoundtrackTransport,
  soundtrackInterruptionMessage,
} from '../../lib/replay-soundtrack-transport.ts';

class FakeMedia {
  paused = true;
  ended = false;
  currentTime = 0;
  readyState = 4;
  error = null;
  playCalls = 0;
  pauseCalls = 0;
  pending = [];
  listeners = new Map();

  addEventListener(type, listener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  removeEventListener(type, listener) {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((candidate) => candidate !== listener),
    );
  }

  get listenerCount() {
    return [...this.listeners.values()].reduce((sum, list) => sum + list.length, 0);
  }

  emit(type) {
    for (const listener of this.listeners.get(type) ?? []) listener({ type });
  }

  /**
   * As in browsers, `play()` clears `paused` at once but only resolves when
   * the test says playback really started (decoder spun up, autoplay policy
   * checked), which can be well after the next click.
   */
  play() {
    this.playCalls += 1;
    this.paused = false;
    return new Promise((resolve, reject) => {
      this.pending.push({ start: resolve, fail: reject });
    });
  }

  pause() {
    this.pauseCalls += 1;
    this.paused = true;
  }

  async settle(index, outcome = 'start') {
    const request = this.pending[index];
    if (outcome === 'start') request.start();
    else request.fail(new DOMException('interrupted', 'AbortError'));
    await Promise.resolve();
  }
}

function harness() {
  const interruptions = [];
  const transport = new SoundtrackTransport((interruption) => interruptions.push(interruption));
  const media = new FakeMedia();
  transport.attach(media);
  return { transport, media, interruptions };
}

async function playing(from = 0) {
  const scene = harness();
  const started = scene.transport.play(from);
  await scene.media.settle(0);
  assert.equal(await started, true);
  return scene;
}

test('the media clock drives the show while running and holds it while buffering', async () => {
  const { transport, media } = await playing(12);
  assert.equal(media.currentTime, 12, 'play seeks the media to the playhead first');
  media.currentTime = 12.5;
  assert.deepEqual(transport.sample(), { state: 'running', time: 12.5 });

  media.emit('waiting');
  assert.deepEqual(transport.sample(), { state: 'buffering', time: 12.5 });
  media.emit('playing');
  media.readyState = 2;
  assert.equal(transport.sample().state, 'buffering', 'starved of future data');
  media.readyState = 4;
  media.currentTime = 12.6;
  assert.deepEqual(transport.sample(), { state: 'running', time: 12.6 });

  media.currentTime = Number.NaN;
  assert.equal(transport.time, 12.6, 'a non-finite media time never reaches the show');
});

test('media paused behind our back with the show still playing freezes it at the media time, once', async () => {
  const { transport, media, interruptions } = await playing();
  media.currentTime = 39.02;
  // The browser stopped the element but, as reproduced, delivered no event yet.
  media.paused = true;
  assert.deepEqual(transport.sample(), { state: 'interrupted', time: 39.02, reason: 'paused' });
  assert.deepEqual(interruptions, [{ reason: 'paused', time: 39.02 }]);

  media.emit('pause');
  transport.sample();
  assert.equal(interruptions.length, 1, 'the late event and later frames do not repeat it');

  // Play is the way back: the next request resumes from where it stopped.
  const resumed = transport.play(39.02);
  await media.settle(1);
  assert.equal(await resumed, true);
  media.currentTime = 39.1;
  assert.deepEqual(transport.sample(), { state: 'running', time: 39.1 });
});

test('a pause event from the browser is reported without waiting for a frame; our own pause is not', async () => {
  const { transport, media, interruptions } = await playing();
  media.currentTime = 5;
  media.paused = true;
  media.emit('pause');
  assert.deepEqual(interruptions, [{ reason: 'paused', time: 5 }]);

  const again = transport.play(5);
  await media.settle(1);
  assert.equal(await again, true);
  transport.pause();
  media.emit('pause');
  assert.equal(interruptions.length, 1, 'pausing ourselves is not an interruption');
  assert.equal(media.pauseCalls, 1);
});

test('a media error stops the show with the error attached; reaching the end is not an error', async () => {
  const { transport, media, interruptions } = await playing();
  media.currentTime = 20;
  const failure = { code: 2, message: 'network' };
  media.error = failure;
  media.emit('error');
  assert.deepEqual(interruptions, [{ reason: 'error', time: 20, error: failure }]);
  assert.equal(transport.sample().reason, 'error');

  const ended = await playing();
  ended.media.currentTime = 155;
  ended.media.ended = true;
  ended.media.paused = true;
  ended.media.emit('pause');
  assert.deepEqual(ended.interruptions, [{ reason: 'ended', time: 155 }]);
});

test('a play request withdrawn by a pause cannot start playback when the browser answers late', async () => {
  const { transport, media, interruptions } = harness();
  const late = transport.play(0);
  transport.pause();
  assert.equal(media.pauseCalls, 1);
  await media.settle(0);
  assert.equal(await late, false, 'the stale request reports that nothing started');
  assert.equal(media.paused, true, 'and the media the browser started is stopped again');
  assert.equal(media.pauseCalls, 2);
  assert.deepEqual(interruptions, []);
});

test('only the newest of overlapping play requests starts the show; a stale rejection is silent', async () => {
  const { transport, media, interruptions } = harness();
  const first = transport.play(0);
  const second = transport.play(0);
  await media.settle(0);
  assert.equal(await first, false);
  assert.equal(media.paused, false, 'the newer request is still wanted, so the media keeps going');
  await media.settle(1);
  assert.equal(await second, true);

  const third = transport.play(0);
  const fourth = transport.play(0);
  await media.settle(2, 'fail');
  assert.equal(await third, false);
  assert.deepEqual(interruptions, [], 'a superseded request failing is not reported');
  await media.settle(3, 'fail');
  assert.equal(await fourth, false);
  assert.deepEqual(
    interruptions.map((interruption) => interruption.reason),
    ['start-failed'],
    'the current request failing is reported so Play can be offered again',
  );
});

test('swapping the source or unmounting while playing stops the show and the old element', async () => {
  const { transport, media, interruptions } = await playing();
  media.currentTime = 8;
  const replacement = new FakeMedia();
  transport.attach(replacement);
  assert.deepEqual(interruptions, [{ reason: 'detached', time: 8 }]);
  assert.equal(media.paused, true);
  assert.equal(media.listenerCount, 0, 'the old element is unbound');
  assert.ok(replacement.listenerCount > 0);
  assert.equal(transport.sample().state, 'interrupted');
  assert.equal(interruptions.length, 1, 'the replacement sitting paused is not a new interruption');

  const pending = transport.play(8);
  transport.dispose();
  await replacement.settle(0);
  assert.equal(await pending, false);
  assert.equal(replacement.paused, true, 'a request answered after unmount leaves nothing playing');
  assert.equal(replacement.listenerCount, 0);
  assert.equal(transport.attached, false);
  assert.deepEqual(transport.sample(), { state: 'interrupted', time: 8, reason: 'detached' });
});

/**
 * The viewer's Play/Pause handler, with React removed: the click toggles the
 * transport's standing intent synchronously; the show clock only starts when
 * the browser confirms the request that is still current; a pause freezes at
 * the media's own time.
 */
function playPauseButton(scene) {
  const { transport } = scene;
  const show = { playhead: 10, clockRunning: false, label: 'Play', starts: 0 };
  const freeze = (time) => {
    show.playhead = time;
    show.clockRunning = false;
  };
  return {
    show,
    click() {
      if (transport.wantsPlayback) {
        const at = transport.running ? transport.time : show.playhead;
        transport.pause();
        show.label = 'Play';
        freeze(at);
        return;
      }
      show.label = 'Pause';
      void transport.play(show.playhead).then((started) => {
        if (!started) return;
        show.starts += 1;
        show.clockRunning = true;
      });
    },
    interrupted(interruption) {
      show.label = 'Play';
      freeze(interruption.time);
    },
  };
}

test('rapid Play, Pause, Play with a slow browser ends playing once, from the same time', async () => {
  const scene = harness();
  const { media } = scene;
  const button = playPauseButton(scene);
  button.click(); // Play: request 0 pending in the browser.
  assert.equal(
    button.show.label,
    'Pause',
    'the button flips at once, not when the browser answers',
  );
  button.click(); // Pause, before the browser has answered.
  assert.equal(button.show.label, 'Play');
  assert.equal(media.paused, true, 'the media is stopped synchronously');
  assert.equal(button.show.playhead, 10);
  button.click(); // Play again: request 1.
  assert.equal(media.paused, false);

  await media.settle(0); // The browser answers the withdrawn request first.
  assert.equal(button.show.clockRunning, false, 'a withdrawn request never starts the show');
  assert.equal(media.paused, false, 'but it does not stop the request that replaced it');
  await media.settle(1);
  assert.equal(button.show.clockRunning, true);
  assert.equal(button.show.starts, 1, 'exactly one start for three clicks');
  assert.equal(media.currentTime, 10, 'from the time the user paused at');
  assert.deepEqual(scene.transport.sample(), { state: 'running', time: 10 });
});

test('a click storm that ends on Pause leaves media and show stopped at the same time', async () => {
  const scene = harness();
  const { media } = scene;
  const button = playPauseButton(scene);
  for (let i = 0; i < 6; i++) button.click(); // Play, Pause, Play, Pause, Play, Pause.
  assert.equal(media.playCalls, 3);
  assert.equal(media.paused, true);
  assert.equal(button.show.label, 'Play');
  for (let i = 0; i < 3; i++) await media.settle(i);
  assert.equal(button.show.clockRunning, false, 'no late answer restarts a paused show');
  assert.equal(media.paused, true);
  assert.equal(button.show.playhead, 10);
  assert.equal(scene.interruptions.length, 0, 'nothing here was unexpected');

  // A lone Play after the storm works normally.
  button.click();
  await media.settle(3);
  assert.equal(button.show.clockRunning, true);
  assert.equal(button.show.starts, 1);
});

test('pause and resume land on the media time, not a stale playhead', async () => {
  const scene = await playing(10);
  const { media, transport } = scene;
  const button = playPauseButton(scene);
  button.show.clockRunning = true;
  media.currentTime = 12.34; // The show clock lags the media by up to a frame.
  button.click(); // Pause.
  assert.equal(button.show.playhead, 12.34, 'frozen where the music actually was');
  assert.equal(media.paused, true);
  assert.equal(media.currentTime, 12.34);

  button.click(); // Resume.
  assert.equal(media.currentTime, 12.34, 'no seek for a resume from the same place');
  await media.settle(1);
  assert.equal(button.show.clockRunning, true);
  assert.equal(transport.running, true);
});

test('a browser pause during a click storm is reported once and the next Play recovers', async () => {
  const scene = await playing(10);
  const { media, interruptions } = scene;
  const button = playPauseButton(scene);
  button.show.clockRunning = true;
  media.currentTime = 39.02;
  media.paused = true;
  media.emit('pause'); // The browser stopped it.
  button.interrupted(interruptions[0]);
  assert.equal(button.show.playhead, 39.02);
  assert.equal(button.show.label, 'Play');

  button.click(); // The user answers with Play.
  button.click(); // ...and changes their mind.
  button.click(); // ...and back.
  await media.settle(1);
  await media.settle(2);
  assert.equal(button.show.clockRunning, true);
  assert.equal(interruptions.length, 1);
  assert.equal(media.currentTime, 39.02);
});

test('seeking leaves tiny differences alone and never starts the media', () => {
  const { transport, media } = harness();
  media.currentTime = 10;
  transport.seek(10.05);
  assert.equal(media.currentTime, 10);
  transport.seek(11);
  assert.equal(media.currentTime, 11);
  assert.equal(media.playCalls, 0);
  assert.equal(media.paused, true);
});

test('every interruption message points the user at Play rather than carrying on silently', () => {
  for (const reason of ['paused', 'error', 'detached', 'start-failed']) {
    assert.match(soundtrackInterruptionMessage(reason), /Play/);
    assert.doesNotMatch(soundtrackInterruptionMessage(reason), /without/i);
  }
  assert.match(soundtrackInterruptionMessage('ended'), /finished/);
});
