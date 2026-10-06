import '../../../../scripts/renderer/register-typescript.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  createPreviewTransport,
  previewTransportTicks,
} from '../../ui/firework-editor/renderer-design/preview-transport.ts';

function fixture() {
  const calls = [];
  const viewer = {
    playing: false,
    options: { loop: true },
    play() {
      this.playing = true;
      calls.push('play');
    },
    pause() {
      this.playing = false;
      calls.push('pause');
    },
    seek(seconds) {
      calls.push(['seek', seconds]);
    },
  };
  return { viewer, calls, transport: createPreviewTransport(viewer) };
}

test('editor transport plays and pauses the same viewer', () => {
  const { viewer, calls, transport } = fixture();
  transport.onPlayPause();
  assert.equal(viewer.playing, true);
  transport.onPlayPause();
  assert.equal(viewer.playing, false);
  assert.deepEqual(calls, ['play', 'pause']);
});

test('scrubbing pauses before seeking and restart returns to zero paused', () => {
  const { viewer, calls, transport } = fixture();
  viewer.playing = true;
  transport.onScrub(2.75);
  assert.equal(viewer.playing, false);
  assert.deepEqual(calls, ['pause', ['seek', 2.75]]);
  calls.length = 0;
  viewer.playing = true;
  transport.onReset();
  assert.equal(viewer.playing, false);
  assert.deepEqual(calls, ['pause', ['seek', 0]]);
});

test('loop toggle changes the live viewer without resetting playback', () => {
  const { viewer, calls, transport } = fixture();
  transport.onLoopToggle();
  assert.equal(viewer.options.loop, false);
  transport.onLoopToggle();
  assert.equal(viewer.options.loop, true);
  assert.deepEqual(calls, []);
});

test('both editors use the shared transport with fullscreen and subscribed viewer state', () => {
  const surface = readFileSync('ui/firework-editor/renderer-design/preview-surface.tsx', 'utf8');
  assert.match(surface, /<EditorPreviewTransport/);
  assert.match(surface, /createPreviewTransport\(instance\)/);
  assert.match(surface, /\.\.\.transport/);
  assert.match(surface, /instance.on\(/);
  assert.match(surface, /elapsed: state.t/);
  assert.match(surface, /playing: state.playing/);
  assert.match(surface, /unsubscribe\(\)/);
  assert.match(surface, /ui: false/);
  for (const kind of ['effects', 'fireworks']) {
    const name = kind === 'effects' ? 'EffectEditor' : 'FireworkEditor';
    const editor = readFileSync(`app/(admin)/admin/${kind}/[id]/_components/${name}.tsx`, 'utf8');
    assert.match(editor, /fullscreen=\{isFullscreen\}/);
    assert.match(editor, /onFullscreenToggle=\{toggleFullscreen\}/);
  }
});

test('timeline markers use authored burst, fade and delayed layer seconds', async () => {
  const { effectTemplates } = await import('@showcrafter/renderer');
  const document = structuredClone(effectTemplates.find((item) => item.key === 'peony').design);
  document.launch.time_s = 2;
  document.breaks = [document.breaks[0]];
  const burst = document.breaks[0];
  burst.at_s = 1;
  burst.fade.fade_at = 0.5;
  burst.layers = [burst.layers[0]];
  Object.assign(burst.layers[0], { delay_s: 1, life_s: 4, life_var: 0.25 });
  assert.deepEqual(previewTransportTicks(document), [
    { timeSeconds: 3, label: 'Burst' },
    { timeSeconds: 6, label: 'Fade starts' },
    { timeSeconds: 9, label: 'Fade finishes' },
  ]);
  document.kind = 'mine';
  assert.equal(previewTransportTicks(document)[0].timeSeconds, 1);
  document.kind = 'fountain';
  assert.deepEqual(previewTransportTicks(document), []);
});
