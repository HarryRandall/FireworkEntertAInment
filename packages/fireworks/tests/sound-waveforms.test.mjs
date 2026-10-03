/** Generated pressure pulses, noise and reflections are reproducible and owned by a voice. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioContext } from './audio-context.mjs';
import { makeSoundBuffers } from '../src/view/sound/buffers.ts';
import { SoundVoice } from '../src/view/sound/voice.ts';
test('N-wave, brown body, short pops and stereo reflections are reproducible at the context sample rate', () => {
  const context = new AudioContext();
  const first = makeSoundBuffers(context);
  const second = makeSoundBuffers(context);
  for (const key of ['white', 'brown', 'nwave', 'pop', 'echo'])
    assert.deepEqual(first[key].getChannelData(0), second[key].getChannelData(0));
  const shock = first.nwave.getChannelData(0);
  assert.equal(shock[0], 1);
  assert.equal(shock[6], 0);
  assert.ok(shock[11] < 0);
  assert.equal(shock.length, 30);
  assert.equal(first.pop.length, 6);
  assert.equal(first.echo.numberOfChannels, 2);
  assert.notDeepEqual(first.echo.getChannelData(0), first.echo.getChannelData(1));
});

test('a sustained source retains its bus through the echo tail and releases nodes afterwards', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const context = new AudioContext();
  const voice = new SoundVoice(context, makeSoundBuffers(context), 0.7);
  const output = voice.output;
  try {
    let input;
    voice.event(
      () => {
        input = voice.bus(1, 100, 0);
        voice.play(voice.buffers.white, 10, input, { loop: true, duration: 20 });
      },
      10,
      20,
    );
    t.mock.timers.tick(23_000);
    assert.equal(input.disconnected, false, 'long fountain is not cut at eight seconds');
    t.mock.timers.tick(1_000);
    assert.equal(input.disconnected, true);
    assert.equal(output.disconnected, false, 'event release does not disconnect the shared voice');
  } finally {
    voice.hush();
  }
});
test('pause silences an isolated voice, stops all future sources and releases echoes immediately', () => {
  const context = new AudioContext();
  const buffers = makeSoundBuffers(context);
  const first = new SoundVoice(context, buffers, 0.7);
  const second = new SoundVoice(context, buffers, 0.7);
  try {
    const input = first.bus(1, 100, 0);
    first.play(buffers.pop, 11, input);
    second.play(buffers.pop, 11, second.bus(1, 100, 0));
    first.hush();
    assert.equal(first.output.gain.value, 0);
    assert.equal(first.output.disconnected, true);
    assert.equal(second.output.disconnected, false, 'another preview retains its own echo path');
  } finally {
    first.hush();
    second.hush();
  }
});
