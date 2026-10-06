'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Viewer } from '@showcrafter/renderer/view';
import { shotDuration } from '@showcrafter/renderer';
import { DEFAULT_FIREWORK_SPEC } from '@showcrafter/fireworks/spec';
import { estimateFireworkDesignTiming } from '@showcrafter/fireworks/timing';
import type { ReplayCue } from '@/lib/show-domain';
import { Button } from '@/ui/patterns/Button';
import { InlineAlert } from '@/ui/patterns/Feedback';
import type { ComparisonRow } from './types';

const OldCanvas = dynamic(
  () => import('@/ui/replay/FireworkReplayCanvas').then((module) => module.FireworkReplayCanvas),
  { ssr: false },
);
// Browser animation timestamps are milliseconds; renderer playback is in seconds.
const MILLISECONDS_PER_SECOND = 1000;

/** Synchronises the two saved designs with a silent shared playhead and explicit playback. */
export default function ComparisonPair({ row }: { row: ComparisonRow }) {
  const container = useRef<HTMLDivElement>(null);
  const oldContainer = useRef<HTMLDivElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const durationS = Math.max(
    row.durationSeconds ?? 0,
    row.newDesign ? shotDuration(row.newDesign) : 0,
    row.oldDesign ? estimateFireworkDesignTiming(row.oldDesign).endSeconds : 0,
  );
  const cues = useMemo<ReplayCue[]>(
    () => [
      {
        id: row.id,
        position: 1,
        timeSeconds: 0,
        description: row.name,
        productId: row.id,
        launchPositionIndex: 0,
        firework: {
          id: row.id,
          slug: row.slug,
          name: row.name,
          description: null,
          sortOrder: 0,
          durationSeconds: row.durationSeconds,
          heightMeters: null,
          caliber: row.caliber,
          shotCount: 1,
          spec: DEFAULT_FIREWORK_SPEC,
          rawSpec: {},
          renderDesign: row.oldDesign,
          baseEffect: null,
          variant: null,
        },
      },
    ],
    [row],
  );
  useEffect(() => {
    const surface = oldContainer.current;
    return () => {
      // The shared old canvas disposes GPU resources but leaves context release to GC.
      // Release its context explicitly when changing rows, even during rapid selection.
      surface
        ?.querySelector('canvas')
        ?.getContext('webgl2')
        ?.getExtension('WEBGL_lose_context')
        ?.loseContext();
    };
  }, []);
  useEffect(() => {
    if (!container.current || !row.newDesign) return;
    try {
      const instance = new Viewer(container.current, {
        design: row.newDesign,
        ui: false,
        autoplay: false,
        clickToPause: false,
      });
      viewer.current = instance;
      return () => {
        viewer.current = null;
        instance.dispose();
      };
    } catch {
      setError('The new renderer could not start. Check WebGL availability.');
    }
  }, [row]);
  useEffect(() => {
    viewer.current?.seek(elapsed);
  }, [elapsed]);
  useEffect(() => {
    if (!playing) return;
    let previousMs: number | null = null;
    let frame = 0;
    function tick(timestampMs: number) {
      if (previousMs !== null) {
        const deltaS = (timestampMs - previousMs) / MILLISECONDS_PER_SECOND;
        setElapsed((timeS) => (timeS + deltaS) % durationS);
      }
      previousMs = timestampMs;
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, durationS]);
  return (
    <div className="space-y-3">
      {error && <InlineAlert tone="danger" title={error} />}
      <div className="grid gap-3 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-medium">Old renderer</h3>
          <div
            ref={oldContainer}
            className="border-border relative aspect-video overflow-hidden rounded border"
          >
            <OldCanvas
              cues={cues}
              elapsed={elapsed}
              muted
              interactive
              controlsVisible={false}
              showCameraControls={false}
            />
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-medium">New renderer</h3>
          <div
            ref={container}
            aria-label={`${row.name} new rendering`}
            className="border-border relative aspect-video overflow-hidden rounded border"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="secondary" onClick={() => setPlaying(!playing)}>
          {playing ? 'Pause' : 'Play'}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setPlaying(false);
            setElapsed(0);
          }}
        >
          Reset
        </Button>
        <label className="flex flex-1 items-center gap-2 text-sm">
          Time
          <input
            aria-label={`${row.name} comparison time`}
            type="range"
            min={0}
            max={durationS}
            step={0.01}
            value={elapsed}
            onChange={(event) => {
              setPlaying(false);
              setElapsed(Number(event.target.value));
            }}
            className="w-full"
          />
        </label>
        <span className="text-muted-foreground text-xs">{elapsed.toFixed(1)} s</span>
      </div>
    </div>
  );
}
