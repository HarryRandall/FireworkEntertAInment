import type { Viewer } from '@showcrafter/renderer/view';

/** Signals readiness after each sequence's first completed demand draw, including late cue completion. */
export function viewerReadiness(
  viewer: Pick<Viewer, 'renderer' | 'on'>,
  notify: () => { final: boolean; scene: () => void; ready: () => void },
) {
  let sceneReady = false;
  let reported = false;
  const report = () => {
    if (viewer.renderer.domElement.dataset.drawPending !== 'false') return;
    const current = notify();
    if (!sceneReady) {
      sceneReady = true;
      current.scene();
    }
    if (!reported && current.final) {
      reported = true;
      current.ready();
    }
  };
  const dispose = viewer.on(report);
  return {
    report,
    reset: () => {
      sceneReady = false;
      reported = false;
    },
    dispose,
  };
}
