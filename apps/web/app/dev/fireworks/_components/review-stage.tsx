/** Selected preview, status and playback controls for the shared WebGL context. */
'use client';
import type { RefObject, Dispatch, SetStateAction } from 'react';
import type { Viewer } from '@showcrafter/fireworks/view';
import { Button } from '@/ui/primitives/button';
import type { entries } from './review-catalogue';
import type { ReviewState } from './review-state';
// Prototype review UI uses 0.01-second seek granularity.
const SEEK_STEP_S = 0.01;
interface StageProps {
  selected: (typeof entries)[number];
  host: RefObject<HTMLDivElement | null>;
  viewer: RefObject<Viewer | null>;
  large: boolean;
  setLarge: Dispatch<SetStateAction<boolean>>;
  ready: boolean;
  error: string;
  state: ReviewState;
  generation: number;
  setGeneration: Dispatch<SetStateAction<number>>;
}
/** Renders the selected design without owning an additional WebGL context. */
export function ReviewStage({
  selected,
  host,
  viewer,
  large,
  setLarge,
  ready,
  error,
  state,
  generation,
  setGeneration,
}: StageProps) {
  return (
    <section aria-label="Selected firework" className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold" data-testid="selected-name">
          {selected.name}
        </h2>
        <span className="text-muted-foreground">{selected.group}</span>
        <Button
          variant="outline"
          onClick={() => {
            setLarge(!large);
          }}
          aria-pressed={large}
        >
          {large ? 'Standard view' : 'Open large'}
        </Button>
      </div>
      <div
        ref={host}
        data-testid="stage"
        className={`bg-muted overflow-hidden rounded-xl border ${large ? 'h-[75dvh]' : 'aspect-[16/10] max-h-[600px]'}`}
      />
      <PreviewStatus
        error={error}
        ready={ready}
        retry={() => {
          setGeneration(generation + 1);
        }}
      />
      <PlaybackControls viewer={viewer} ready={ready} state={state} />
      <p className="text-muted-foreground text-sm">
        {state.hdr ? 'HDR' : '8-bit'} output · {state.count.toLocaleString('en-GB')} particles · CPU
        sprays
      </p>
    </section>
  );
}
function PreviewStatus({
  error,
  ready,
  retry,
}: {
  error: string;
  ready: boolean;
  retry: () => void;
}) {
  if (error.length > 0)
    return (
      <div role="alert">
        <p>Preview unavailable: {error}</p>
        <Button onClick={retry}>Try again</Button>
      </div>
    );
  if (!ready) return <p role="status">Preparing shared-context previews...</p>;
  return null;
}
function PlaybackControls({
  viewer,
  ready,
  state,
}: Pick<StageProps, 'viewer' | 'ready' | 'state'>) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button disabled={!ready} onClick={() => viewer.current?.toggle()}>
        {state.playing ? 'Pause' : 'Play'}
      </Button>
      <Button
        disabled={!ready}
        variant="outline"
        onClick={() => {
          viewer.current?.seek(0);
          viewer.current?.play();
        }}
      >
        Restart
      </Button>
      <label className="flex min-w-40 flex-1 items-center gap-2">
        Time
        <input
          className="w-full"
          type="range"
          aria-label="Preview time"
          min={0}
          max={state.duration}
          step={SEEK_STEP_S}
          value={state.t}
          disabled={!ready}
          onChange={(event) => {
            viewer.current?.pause();
            viewer.current?.seek(Number(event.target.value));
          }}
        />
      </label>
      <output className="font-mono text-sm">
        {state.t.toFixed(2)} / {state.duration.toFixed(2)} s
      </output>
      <Button disabled={!ready} variant="outline" onClick={() => viewer.current?.resetCamera()}>
        Reset view
      </Button>
    </div>
  );
}
