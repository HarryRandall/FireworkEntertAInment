/** Paired renderer and local video previews follow the draft's shared transport. */
'use client';
import { useState } from 'react';
import { ComparePreview } from './compare-preview';
import { ReferenceVideo } from './reference-video';
import type { Design } from '@showcrafter/fireworks';
import { useStudioViewer } from './use-studio-viewer';
import { Button } from '@/ui/primitives/button';

const SCRUB_STEP_S = 0.01; // Player tuning in seconds for precise seeking, matching the renderer player.
const CLOCK_DECIMALS = 1; // Tenths of a second keep the floating transport readable.
/** Displays paired previews and transport in seconds; optional listener distance is world metres. */
export function StudioStage({
  document,
  hidden,
  listenerDistanceM,
  published,
}: {
  published: { document: Design; number: number } | null;
  document: Design;
  hidden: boolean;
  listenerDistanceM: number | null;
}) {
  const [mode, setMode] = useState('design');
  const { container, viewer, failure, clock } = useStudioViewer(
    document,
    hidden,
    listenerDistanceM,
  );
  return (
    <section aria-label="Stage" className="sc-studio-stage bg-stage text-stage-foreground">
      <StageModes mode={mode} onChange={setMode} />
      <div className={`sc-studio-previews ${mode === 'design' ? '' : 'sc-studio-previews-two'}`}>
        {mode === 'compare' &&
          (published ? (
            <ComparePreview published={published} leader={viewer} />
          ) : (
            <div className="sc-studio-pane p-4">
              <h2>Published</h2>
              <p>No published version yet.</p>
            </div>
          ))}
        {mode === 'reference' && <ReferenceVideo leader={viewer} />}
        <div className="sc-studio-pane" data-preview="draft">
          <h2>{mode === 'design' ? 'Design preview' : 'Draft'}</h2>
          <div ref={container} className="absolute inset-0" aria-label="Live firework preview" />
        </div>
      </div>
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
            const timeS = Number(event.target.value);
            viewer.current?.pause();
            viewer.current?.seek(timeS);
          }}
        />
        <output className="font-mono text-xs tabular-nums">
          {clock.time.toFixed(CLOCK_DECIMALS)} / {clock.duration.toFixed(CLOCK_DECIMALS)} s
        </output>
      </div>
    </section>
  );
}

function StageModes({ mode, onChange }: { mode: string; onChange: (mode: string) => void }) {
  return (
    <div role="group" aria-label="Stage mode" className="sc-studio-modes">
      {['design', 'compare', 'reference'].map((value) => (
        <Button
          key={value}
          variant="ghost"
          aria-pressed={mode === value}
          onClick={() => {
            onChange(value);
          }}
        >
          {value.charAt(0).toUpperCase()}
          {value.slice(1)}
        </Button>
      ))}
    </div>
  );
}
