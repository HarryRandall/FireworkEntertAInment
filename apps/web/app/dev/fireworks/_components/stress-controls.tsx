/** Developer-only CPU/GPU comparison controls and rolling frame cadence readout. */
'use client';
import type { RefObject } from 'react';
import type { Design } from '@showcrafter/fireworks';
import type { Viewer } from '@showcrafter/fireworks/view';
import { Button } from '@/ui/primitives/button';
import type { ReviewState } from './review-state';
import { stressShots } from './stress-scene';

/** Runs the same finale and instant through either kernel, using the existing shared context. */
export function StressControls({
  viewer,
  ready,
  state,
  selected,
}: {
  viewer: RefObject<Viewer | null>;
  ready: boolean;
  state: ReviewState;
  selected: Design;
}) {
  return (
    <section
      aria-label="Spray performance comparison"
      className="bg-card grid gap-3 rounded-xl border p-4"
    >
      <h3 className="font-semibold">Spray performance comparison</h3>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!ready}
          onClick={() => {
            viewer.current?.setShots(stressShots());
            viewer.current?.seek(0);
            viewer.current?.play();
          }}
        >
          Run 40-shot finale
        </Button>
        <Button
          disabled={!ready}
          variant="outline"
          onClick={() => {
            viewer.current?.setDesign(selected);
            viewer.current?.seek(0);
            viewer.current?.play();
          }}
        >
          Back to one firework
        </Button>
        {(['gpu', 'cpu'] as const).map((mode) => (
          <Button
            key={mode}
            disabled={!ready}
            variant="outline"
            aria-pressed={state.sprayMode === mode}
            onClick={() => viewer.current?.setSprayMode(mode)}
          >
            {mode.toUpperCase()} sprays
          </Button>
        ))}
      </div>
      <p className="font-mono text-sm" data-testid="frame-times">
        Frame intervals: median {state.timing.medianMs.toFixed(2)} ms · 95th percentile{' '}
        {state.timing.p95Ms.toFixed(2)} ms ({state.timing.samples}/{state.timing.window} playing
        frames)
      </p>
      <p className="text-muted-foreground text-sm">
        Rolling window of the last {state.timing.window} visible playing frames, reset when the
        scene or spray path changes. CPU build and draw submission: {state.frameMs.toFixed(2)} ms
        (smoothed; excludes GPU completion). Run each path from Restart in the same window on your
        machine. Browser automation can throttle frame cadence. Particle count includes GPU
        candidates that the shader may hide.
      </p>
    </section>
  );
}
