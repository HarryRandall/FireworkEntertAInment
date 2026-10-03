/** One cinematic viewer with an accessible transport and explicit GPU failure state. */
'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Viewer,
  developedTime,
  SETTINGS,
  setSetting,
  type Shot,
} from '@showcrafter/fireworks/view';
import { Button } from '@/ui/primitives/button';
import { useSoundtrack } from './use-soundtrack';
import { recordShopperEvent } from '@/lib/shopper/events/client';
import type { ShopperEvent } from '@/lib/shopper/events/contracts';

// QR prototype stage height: 360 CSS px minimum, 64 viewport-height units, 760 CSS px maximum.
const STAGE_HEIGHT_CLASS = 'h-[clamp(360px,64vh,760px)]';
const SEEK_STEP_SECONDS = 0.1; // Visual transport tuning: a tenth-second keyboard nudge.
const SECONDS_PER_MINUTE = 60; // Clock display unit conversion.
const CLOCK_DIGITS = 2; // Seconds retain two digits in the transport clock.
function clock(seconds: number): string {
  return `${String(Math.floor(seconds / SECONDS_PER_MINUTE))}:${String(Math.floor(seconds % SECONDS_PER_MINUTE)).padStart(CLOCK_DIGITS, '0')}`;
}
function usePreview(shots: readonly Shot[], prop?: 'cake') {
  const container = useRef<HTMLDivElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const [state, setState] = useState({ time: 0, duration: 0, playing: false, sound: false });
  const [error, setError] = useState<string>();
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let active: Viewer | undefined;
    let unsubscribe: (() => void) | undefined;
    try {
      const first = shots.at(0);
      if (!first) throw new Error('No published shots available');
      active = new Viewer(element, {
        shots,
        prop,
        autoplay: false,
        clickToPause: false,
        // A paused developed moment gives immediate value without automatic motion or sound.
        startAt: (first.t0 ?? 0) + developedTime(first.design),
      });
      viewer.current = active;
      const update = (value: Viewer) => {
        setState({
          time: value.t,
          duration: value.duration,
          playing: value.playing,
          sound: SETTINGS.sound,
        });
      };
      update(active);
      unsubscribe = active.on(update);
      setError(undefined);
    } catch (failure) {
      console.error('Firework preview failed', failure);
      setError('The 3D preview could not load. You can still browse the shop below.');
    }
    return () => {
      unsubscribe?.();
      active?.dispose();
      viewer.current = null;
    };
  }, [shots, prop]);
  return { container, viewer, state, error };
}
/** Mounts and disposes one viewer for immutable shots; times are seconds from sequence start. */
export function Preview({
  shots,
  title,
  prop,
  soundtrackUrl,
  soundtrackOffsetMs = 0,
  event,
}: {
  shots: readonly Shot[];
  title: string;
  prop?: 'cake';
  soundtrackUrl?: string;
  soundtrackOffsetMs?: number;
  event?: Pick<ShopperEvent, 'store' | 'context'>;
}) {
  const { container, viewer, state, error } = usePreview(shots, prop);
  usePlaybackEvent(state.playing, event);
  const soundtrack = useSoundtrack(
    viewer,
    { url: soundtrackUrl, offsetMs: soundtrackOffsetMs },
    shots,
    state.duration,
  );
  return (
    <section
      aria-label={`${title} preview`}
      data-section="preview"
      className="bg-stage text-stage-foreground relative"
    >
      <div ref={container} className={`relative ${STAGE_HEIGHT_CLASS} overflow-hidden`} />
      <div className="bg-stage/90 absolute inset-x-0 bottom-0 grid gap-3 p-4">
        <p className="truncate text-sm font-semibold">{title}</p>
        {soundtrack.failure !== undefined ? <p role="alert">{soundtrack.failure}</p> : null}
        {error !== undefined ? (
          <p role="alert">{error}</p>
        ) : (
          <div role="group" aria-label="Playback" className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              disabled={state.duration === 0}
              onClick={() => {
                if (soundtrack.transport.current)
                  soundtrack.transport.current.toggle().catch(console.error);
                else viewer.current?.toggle();
              }}
            >
              {state.playing ? 'Pause' : 'Play'}
            </Button>
            <input
              aria-label="Show time"
              type="range"
              min={0}
              max={state.duration}
              step={SEEK_STEP_SECONDS}
              value={state.time}
              onChange={(event) => {
                const seconds = Number(event.target.value);
                if (soundtrack.transport.current) soundtrack.transport.current.seek(seconds);
                else viewer.current?.seek(seconds);
              }}
              className="accent-highlight focus-visible:outline-ring min-w-0 flex-1 focus-visible:outline-2 focus-visible:outline-offset-4"
            />
            <span className="font-mono text-xs tabular-nums">
              {clock(state.time)} / {clock(state.duration)}
            </span>
            <Button
              variant="secondary"
              onClick={() => {
                setSetting('sound', !state.sound);
              }}
            >
              {state.sound ? 'Mute' : 'Sound on'}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

function usePlaybackEvent(playing: boolean, event?: Pick<ShopperEvent, 'store' | 'context'>) {
  const previouslyPlaying = useRef(false);
  useEffect(() => {
    if (playing && !previouslyPlaying.current && event !== undefined)
      recordShopperEvent({ ...event, type: 'play', props: {} });
    previouslyPlaying.current = playing;
  }, [playing, event]);
}
