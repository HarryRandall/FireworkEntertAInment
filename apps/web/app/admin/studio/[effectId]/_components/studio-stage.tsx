/** One owned renderer stage and a floating transport for the current draft. */
'use client';
import type { Design } from '@showcrafter/fireworks';
import { useStudioViewer } from './use-studio-viewer';
import { Button } from '@/ui/primitives/button';

const SCRUB_STEP_S = 0.01; // Player tuning in seconds for precise seeking, matching the renderer player.
const CLOCK_DECIMALS = 1; // Tenths of a second keep the floating transport readable.
/** Displays the owned Viewer and transport in seconds; optional listener distance is world metres. */
export function StudioStage({
  document,
  hidden,
  listenerDistanceM,
}: {
  document: Design;
  hidden: boolean;
  listenerDistanceM: number | null;
}) {
  const { container, viewer, failure, clock } = useStudioViewer(
    document,
    hidden,
    listenerDistanceM,
  );
  return (
    <section aria-label="Stage" className="sc-studio-stage bg-stage text-stage-foreground">
      <h2 className="absolute top-4 left-4 z-10 text-sm font-medium">Design preview</h2>
      <div ref={container} className="absolute inset-0" aria-label="Live firework preview" />
      {failure !== '' && (
        <p role="alert" className="relative p-12">
          {failure}
        </p>
      )}
      <div
        className="sc-studio-player bg-stage text-stage-foreground"
        role="group"
        aria-label="Playback"
      >
        <Button
          variant="ghost"
          className="hover:bg-stage-foreground/15 hover:text-stage-foreground dark:hover:bg-stage-foreground/15"
          disabled={failure !== ''}
          onClick={() => {
            viewer.current?.toggle();
          }}
        >
          {clock.playing ? 'Pause' : 'Play'}
        </Button>
        <Button
          variant="ghost"
          className="hover:bg-stage-foreground/15 hover:text-stage-foreground dark:hover:bg-stage-foreground/15"
          disabled={failure !== ''}
          onClick={() => {
            viewer.current?.seek(0);
          }}
        >
          Restart
        </Button>
        <input
          type="range"
          aria-label="Preview time"
          min={0}
          max={clock.duration}
          step={SCRUB_STEP_S}
          value={clock.time}
          disabled={clock.duration === 0}
          onChange={(event) => {
            viewer.current?.pause();
            viewer.current?.seek(Number(event.target.value));
          }}
        />
        <output className="font-mono text-xs tabular-nums">
          {clock.time.toFixed(CLOCK_DECIMALS)} / {clock.duration.toFixed(CLOCK_DECIMALS)} s
        </output>
      </div>
    </section>
  );
}
