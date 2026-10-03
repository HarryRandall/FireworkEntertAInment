/** Each synthesis family preserves deterministic pitch and transient source scheduling. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioContext } from './audio-context.mjs';
import { makeSoundBuffers } from '../src/view/sound/buffers.ts';
import { SoundVoice } from '../src/view/sound/voice.ts';
import { playSound } from '../src/view/sound/playback.ts';
import { soundEvents } from '../src/sim/events.ts';
import { reviewFixtureDesign } from '../src/fixtures/index.ts';
const sources = (context) => context.nodes.filter((node) => node.starts.length > 0);
test('each acoustic family schedules owned sources; seeded replay preserves pitch and pop timing', () => {
  const event = soundEvents([{ design: reviewFixtureDesign('peony') }])[0];
  for (const kind of ['boom', 'lift', 'whoosh', 'whistle', 'hiss', 'crackle']) {
    const runs = [];
    for (let replay = 0; replay < 2; replay++) {
      const context = new AudioContext();
      const voice = new SoundVoice(context, makeSoundBuffers(context), 0.7);
      try {
        playSound({
          event: { ...event, kind, duration_s: 3, heavy: true },
          when: 11,
          output: voice.bus(1, 100, 0.8),
          voice,
        });
        runs.push(
          sources(context).map((node) => ({
            starts: node.starts,
            rate: node.playbackRate.value,
            frequency: node.frequency.calls,
          })),
        );
        assert.ok(runs.at(-1).length > 0, kind);
        if (kind === 'boom') assert.equal(runs.at(-1).length, 4, 'shock, air, body and rumble');
        if (kind === 'crackle') assert.equal(runs.at(-1).length, 90);
      } finally {
        voice.hush();
      }
    }
    assert.deepEqual(runs[0], runs[1], kind);
  }
});
