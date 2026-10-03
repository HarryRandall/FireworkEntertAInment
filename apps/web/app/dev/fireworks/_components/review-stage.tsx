/** Selected preview, status and playback controls for the shared WebGL context. */
'use client';
import type { RefObject, Dispatch, SetStateAction } from 'react';
import type { Viewer } from '@showcrafter/fireworks/view';
import { Button } from '@/ui/primitives/button';
import type { entries } from './review-catalogue';
import type { ReviewState } from './review-state';
import { StressControls } from './stress-controls';
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
          {state.shotCount > 1 ? '40-shot finale' : selected.name}
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
        aria-busy={!ready}
        inert={!ready}
        className={`bg-muted overflow-hidden rounded-xl border ${large ? 'h-[75dvh]' : 'aspect-[16/10] max-h-[600px]'}`}
      />
      <PreviewStatus
        error={error}
        ready={ready}
        retry={() => {
          setGeneration(generation + 1);
        }}
      />
      <p className="text-muted-foreground text-sm">
        {state.hdr ? 'HDR' : '8-bit'} output · {state.count.toLocaleString('en-GB')} particles ·{' '}
        {state.sprayMode.toUpperCase()} sprays
      </p>
      <StressControls viewer={viewer} ready={ready} state={state} selected={selected.design} />
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
        <p>
          {ready ? 'Thumbnail preparation unavailable' : 'Preview unavailable'}: {error}
        </p>
        <Button onClick={retry}>Try again</Button>
      </div>
    );
  if (!ready) return <p role="status">Preparing shared-context previews...</p>;
  return null;
}
