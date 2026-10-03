/** One owned renderer stage and a floating transport for the current draft. */
'use client';
import { useEffect, useRef, useState } from 'react';
import type { Design } from '@showcrafter/fireworks';
import { Viewer } from '@showcrafter/fireworks/view';
import { Button } from '@/ui/primitives/button';

const SCRUB_STEP_S = 0.01; // Player tuning in seconds for precise seeking, matching the renderer player.
const CLOCK_DECIMALS = 1; // Tenths of a second keep the floating transport readable.
/** Mounts one Viewer, updates designs without remounting, and disposes browser resources on exit. */
export function StudioStage({ document, hidden }: { document: Design; hidden: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const initial = useRef(document);
  const [failure, setFailure] = useState('');
  const [clock, setClock] = useState({ time: 0, duration: 0, playing: false });
  useEffect(() => {
    if (!container.current) return;
    let active: Viewer;
    try {
      active = new Viewer(container.current, {
        design: initial.current,
        ui: false,
        clickToPause: false,
      });
    } catch {
      setFailure('The live preview could not start. Check WebGL support and reload.');
      return;
    }
    viewer.current = active;
    const unsubscribe = active.on((value) => {
      setClock({ time: value.t, duration: value.duration, playing: value.playing });
    });
    return () => {
      unsubscribe();
      active.dispose();
      viewer.current = null;
    };
  }, []);
  useEffect(() => {
    if (hidden) viewer.current?.setShots([], true);
    else viewer.current?.setDesign(document, true);
  }, [document, hidden]);
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
          disabled={failure !== ''}
          onClick={() => {
            viewer.current?.toggle();
          }}
        >
          {clock.playing ? 'Pause' : 'Play'}
        </Button>
        <Button
          variant="ghost"
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
