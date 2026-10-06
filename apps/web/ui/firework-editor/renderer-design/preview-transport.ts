import type { Design } from '@showcrafter/renderer';
import type { Viewer } from '@showcrafter/renderer/view';

const PREVIEW_START_SECONDS = 0;

/** Connects the editor transport to the viewer, keeping restart and scrubbing paused. */
export function createPreviewTransport(
  viewer: Pick<Viewer, 'playing' | 'play' | 'pause' | 'seek' | 'options'>,
) {
  return {
    onPlayPause() {
      if (viewer.playing) viewer.pause();
      else viewer.play();
    },
    onReset() {
      viewer.pause();
      viewer.seek(PREVIEW_START_SECONDS);
    },
    onScrub(seconds: number) {
      viewer.pause();
      viewer.seek(seconds);
    },
    onLoopToggle() {
      viewer.options.loop = !viewer.options.loop;
    },
  };
}

/** Marks the authored burst and closing fade on the editor's seek bar. */
export function previewTransportTicks(document: Design) {
  if (!['shell', 'rocket', 'mine'].includes(document.kind)) return [];
  const burst = document.breaks[0];
  if (!burst) return [];
  const start =
    (document.kind === 'mine'
      ? PREVIEW_START_SECONDS
      : (document.launch?.time_s ?? PREVIEW_START_SECONDS)) + burst.at_s;
  const fadeStart = Math.min(
    ...burst.layers.map((layer) => layer.delay_s + layer.life_s * burst.fade.fade_at),
  );
  const lifetime = Math.max(
    ...burst.layers.map((layer) => layer.delay_s + layer.life_s * (1 + layer.life_var)),
  );
  return [
    { timeSeconds: start, label: 'Burst' },
    { timeSeconds: start + fadeStart, label: 'Fade starts' },
    { timeSeconds: start + lifetime, label: 'Fade finishes' },
  ];
}
