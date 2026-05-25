'use client';

/**
 * FireworkReplayViewer — interactive replay + cue editor used on the
 * authenticated show detail route. Wraps the 3D canvas with audio sync
 * controls and server actions for adding / deleting preview cues.
 * Cue mutations go through preview-cues server actions which reject
 * overlaps on the same launch position.
 */
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Pause, Play, Plus, RotateCcw, Sparkles, Trash2 } from 'lucide-react';
import {
  addPreviewCueAction,
  deletePreviewCueAction,
  type CueActionResult,
} from '@/app/actions/preview-cues';
import { Badge, Eyebrow } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import { Input } from '@/app/components/ui/Input';
import { NumberInput } from '@/app/components/ui/NumberInput';
import { SelectField } from '@/app/components/ui/SelectField';
import { StatTile } from '@/app/components/ui/StatTile';
import type { FireworkSpecification, ReplayCue } from '@/lib/show-domain';
import { formatDuration } from '@/lib/show-domain';
import type { LaunchPosition } from '@/lib/fireworks/design';

type FireworkReplayViewerProps = {
  showId: string;
  showSlug: string;
  showName: string;
  durationSeconds: number | null;
  cues: ReplayCue[];
  specifications: FireworkSpecification[];
  launchPositions: LaunchPosition[];
  audioUrl?: string | null;
};

const LAUNCH_POSITION_OPTIONS = [
  { value: '0', label: 'Mortar 1 (left)' },
  { value: '1', label: 'Mortar 2 (centre)' },
  { value: '2', label: 'Mortar 3 (right)' },
];

function ReplayCanvasSkeleton() {
  return (
    <div className="absolute inset-0 h-full w-full animate-pulse bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.12),transparent_28%),linear-gradient(180deg,#05070d,#101522)]" />
  );
}

const LazyFireworkReplayCanvas = dynamic(
  () => import('@/app/components/app/FireworkReplayCanvas').then((mod) => mod.FireworkReplayCanvas),
  {
    ssr: false,
    loading: () => <ReplayCanvasSkeleton />,
  },
);

function EmptyPreview() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8 text-center">
      <div className="border-outline-variant/15 bg-surface-container-low/85 max-w-md rounded-2xl border p-6 backdrop-blur">
        <Sparkles className="text-primary mx-auto mb-4" size={28} />
        <h3 className="text-on-surface text-xl font-bold">No typed fireworks yet</h3>
        <p className="text-on-surface-variant mt-2 text-sm leading-relaxed">
          Add a cue below, then drag the scene to orbit and scroll to zoom.
        </p>
      </div>
    </div>
  );
}

export function FireworkReplayViewer({
  showId,
  showSlug,
  showName,
  durationSeconds,
  cues,
  specifications,
  launchPositions,
  audioUrl = null,
}: FireworkReplayViewerProps) {
  const inferredDuration =
    cues.length > 0 ? Math.max(...cues.map((cue) => cue.timeSeconds)) + 5 : 30;
  const duration = Math.max(durationSeconds ?? inferredDuration, inferredDuration);
  const [elapsed, setElapsed] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [actionResult, setActionResult] = useState<CueActionResult | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | undefined>(
    specifications[0]?.id,
  );
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const startedAt = useRef<number | null>(null);
  const playheadStart = useRef(0);
  const elapsedRef = useRef(elapsed);
  const lastUIElapsedRef = useRef(elapsed);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Keep the audio element in sync with playhead and play/pause state.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      const drift = Math.abs(audio.currentTime - elapsedRef.current);
      if (drift > 0.25) audio.currentTime = elapsedRef.current;
      void audio.play().catch(() => {
        /* autoplay blocked or seek interrupted — ignore */
      });
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  // When the user scrubs the timeline while paused, seek the audio to match.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || isPlaying) return;
    if (Math.abs(audio.currentTime - elapsed) > 0.1) {
      audio.currentTime = elapsed;
    }
  }, [elapsed, isPlaying]);

  // While playing, the RAF loop owns elapsedRef and writes it at 60Hz; mirroring
  // 15Hz React state back on top would create a backward jitter on the engine.
  useEffect(() => {
    if (!isPlaying) {
      elapsedRef.current = elapsed;
      lastUIElapsedRef.current = elapsed;
    }
  }, [elapsed, isPlaying]);

  useEffect(() => {
    if (!isPlaying) return;
    let frame = 0;
    startedAt.current = performance.now();
    playheadStart.current = elapsedRef.current;
    lastUIElapsedRef.current = elapsedRef.current;

    function tick(now: number) {
      if (startedAt.current == null) return;
      const dtFromStart = (now - startedAt.current) / 1000;
      // Browsers throttle/pause RAF on hidden tabs but performance.now() keeps
      // ticking — without this re-anchor we'd leap the playhead by however long
      // the tab was backgrounded and force the engine into a full replay.
      if (dtFromStart > 0.5) {
        startedAt.current = now;
        playheadStart.current = elapsedRef.current;
        frame = requestAnimationFrame(tick);
        return;
      }
      const next = Math.min(duration, playheadStart.current + dtFromStart);
      // 60Hz drive for the engine (via ref); ~15Hz React state for the UI.
      elapsedRef.current = next;
      if (next >= duration || next - lastUIElapsedRef.current >= 0.067) {
        lastUIElapsedRef.current = next;
        setElapsed(next);
      }
      if (next >= duration) {
        setIsPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, isPlaying]);

  const sortedCues = useMemo(() => [...cues].sort((a, b) => a.timeSeconds - b.timeSeconds), [cues]);

  // Collapse expanded shots back to one row per show_cue for the builder list.
  // Multi-shot IDs are "{baseCueId}-shot-N"; single-shot IDs are just the UUID.
  const builderCues = useMemo(() => {
    const seen = new Map<string, { cue: ReplayCue; baseCueId: string; shotCount: number }>();
    for (const cue of sortedCues) {
      const baseCueId = cue.id.replace(/-shot-\d+$/, '');
      if (!seen.has(baseCueId)) {
        seen.set(baseCueId, { cue, baseCueId, shotCount: 1 });
      } else {
        seen.get(baseCueId)!.shotCount += 1;
      }
    }
    return Array.from(seen.values());
  }, [sortedCues]);

  const activeCue = useMemo(() => {
    return [...sortedCues].reverse().find((cue) => cue.timeSeconds <= elapsed + 0.35);
  }, [sortedCues, elapsed]);

  const upcomingCues = useMemo(
    () => sortedCues.filter((cue) => cue.timeSeconds >= elapsed).slice(0, 5),
    [sortedCues, elapsed],
  );

  const hasReplayCues = cues.length > 0;

  function togglePlayback() {
    if (!hasReplayCues) return;
    if (elapsed >= duration) setElapsed(0);
    setIsPlaying((playing) => !playing);
  }

  function restart() {
    setIsPlaying(false);
    setElapsed(0);
  }

  function addCue(formData: FormData) {
    startTransition(async () => {
      const result = await addPreviewCueAction(formData);
      setActionResult(result);
      if (result.ok) formRef.current?.reset();
    });
  }

  function deleteCue(cueId: string) {
    const formData = new FormData();
    formData.set('cueId', cueId);
    formData.set('showSlug', showSlug);
    startTransition(async () => {
      setActionResult(await deletePreviewCueAction(formData));
    });
  }

  return (
    <div className="space-y-6">
      <Card
        elevation="low"
        radius="lg"
        className="from-surface-container-high via-surface-container to-surface-container-low overflow-hidden bg-gradient-to-b p-0 shadow-[var(--shadow-card-hover)]"
      >
        <div className="relative h-[min(72vh,680px)] min-h-[520px]">
          <div className="absolute top-6 left-6 z-10 space-y-2">
            <Badge tone={isPlaying ? 'live' : 'neutral'}>
              {isPlaying ? 'Live replay' : 'Interactive preview'}
            </Badge>
            <h2 className="text-on-surface max-w-xl text-3xl font-extrabold tracking-tight md:text-4xl">
              {showName}
            </h2>
            <p className="text-on-surface-variant max-w-sm text-xs font-medium">
              Drag to orbit. Scroll to zoom. Use the timeline to scrub.
            </p>
          </div>

          <LazyFireworkReplayCanvas
            cues={sortedCues}
            elapsed={elapsed}
            playbackRef={elapsedRef}
            launchPositions={launchPositions}
            muted={!isPlaying}
          />

          {!hasReplayCues ? <EmptyPreview /> : null}
          {audioUrl ? (
            <audio
              ref={audioRef}
              src={audioUrl}
              preload="auto"
              className="hidden"
              onEnded={() => setIsPlaying(false)}
            />
          ) : null}
        </div>

        <div className="border-outline-variant/15 bg-surface-container-low/90 border-t px-5 py-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={togglePlayback}
              disabled={!hasReplayCues}
              aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
              className="focus-glow-action bg-primary-container text-on-primary-container disabled:bg-surface-container-high disabled:text-on-surface-variant/40 flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-[var(--shadow-cta)] transition-all hover:brightness-110 focus:outline-none focus-visible:outline-none active:scale-[0.98] disabled:cursor-not-allowed disabled:shadow-none"
            >
              {isPlaying ? (
                <Pause size={18} strokeWidth={2.5} />
              ) : (
                <Play size={18} strokeWidth={2.5} />
              )}
            </button>
            <button
              type="button"
              onClick={restart}
              aria-label="Restart preview"
              className="focus-glow-action border-outline/20 text-primary hover:bg-surface-container-highest/50 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all focus:outline-none focus-visible:outline-none active:scale-[0.98]"
            >
              <RotateCcw size={16} strokeWidth={2} />
            </button>

            <div className="flex flex-1 items-center gap-3">
              <span className="text-tertiary/80 min-w-[2.75rem] font-mono text-[11px] tabular-nums">
                {formatDuration(elapsed)}
              </span>
              <input
                type="range"
                min={0}
                max={duration}
                step={0.05}
                value={elapsed}
                onChange={(event) => {
                  setIsPlaying(false);
                  setElapsed(Number(event.target.value));
                }}
                className="accent-tertiary h-2 flex-1"
                aria-label="Preview timeline"
              />
              <span className="text-tertiary/80 min-w-[2.75rem] text-right font-mono text-[11px] tabular-nums">
                {formatDuration(duration)}
              </span>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card elevation="high" radius="md" className="space-y-5 p-6">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <Eyebrow tone="muted">Cue builder</Eyebrow>
              <h3 className="text-on-surface mt-2 text-2xl font-bold">Add or remove fireworks</h3>
            </div>
            {actionResult ? (
              <p
                className={
                  actionResult.ok
                    ? 'text-primary text-sm font-semibold'
                    : 'text-error text-sm font-semibold'
                }
              >
                {actionResult.ok ? actionResult.message : actionResult.error}
              </p>
            ) : null}
          </div>

          <form
            ref={formRef}
            action={addCue}
            className="border-outline-variant/15 bg-surface-container-low grid grid-cols-1 gap-3 rounded-xl border p-4 md:grid-cols-[1fr_120px_140px_1.4fr_auto] md:items-end"
          >
            <input type="hidden" name="showId" value={showId} />
            <input type="hidden" name="showSlug" value={showSlug} />
            <label className="space-y-2">
              <span className="text-on-surface-variant text-[10px] font-bold tracking-widest uppercase">
                Firework
              </span>
              <SelectField
                name="productId"
                required
                placeholder="Select firework"
                defaultValue={specifications[0]?.id}
                options={specifications.map((spec) => ({
                  value: spec.id,
                  label: spec.name,
                }))}
                onChange={(value) => setSelectedProductId(value)}
              />
            </label>
            <label className="space-y-2">
              <span className="text-on-surface-variant text-[10px] font-bold tracking-widest uppercase">
                Mortar
              </span>
              <SelectField
                name="launchPositionIndex"
                defaultValue="1"
                options={LAUNCH_POSITION_OPTIONS}
              />
            </label>
            <label className="space-y-2">
              <span className="text-on-surface-variant text-[10px] font-bold tracking-widest uppercase">
                Time
              </span>
              <NumberInput
                name="timeSeconds"
                min={0}
                max={duration}
                step={0.5}
                defaultValue={Math.min(duration, Math.round(elapsed + 3))}
                required
                ariaLabel="Cue time in seconds"
              />
            </label>
            <label className="space-y-2">
              <span className="text-on-surface-variant text-[10px] font-bold tracking-widest uppercase">
                Label
              </span>
              <Input
                key={selectedProductId}
                name="description"
                defaultValue={specifications.find((s) => s.id === selectedProductId)?.name ?? ''}
                required
              />
            </label>
            <Button type="submit" disabled={isPending || specifications.length === 0}>
              <Plus size={16} strokeWidth={2} />
              Add
            </Button>
          </form>

          <div className="space-y-3">
            {builderCues.length > 0 ? (
              builderCues.map(({ cue, baseCueId, shotCount }) => (
                <div
                  key={baseCueId}
                  className="border-outline-variant/10 bg-surface-container-highest/60 flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-tertiary font-mono text-sm font-bold tabular-nums">
                        {formatDuration(cue.timeSeconds)}
                      </span>
                      <span className="text-on-surface font-semibold">
                        {cue.description || cue.firework.name}
                      </span>
                      <span className="text-on-surface-variant text-[10px] font-bold tracking-widest uppercase">
                        {LAUNCH_POSITION_OPTIONS[cue.launchPositionIndex]?.label ??
                          `Mortar ${cue.launchPositionIndex + 1}`}
                      </span>
                      {shotCount > 1 && (
                        <span className="text-on-surface-variant text-[10px] font-bold tracking-widest uppercase">
                          {shotCount} shots
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteCue(baseCueId)}
                    disabled={isPending}
                    className="focus-glow-action border-outline/20 text-on-surface-variant hover:bg-surface-container-high hover:text-error inline-flex h-10 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition-all focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 size={15} strokeWidth={2} />
                    Remove
                  </button>
                </div>
              ))
            ) : (
              <p className="border-outline-variant/15 bg-surface-container-low text-on-surface-variant rounded-xl border p-4 text-sm">
                No cues yet. Add your first firework above to make the preview playable.
              </p>
            )}
          </div>
        </Card>

        <aside className="space-y-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <StatTile label="Total effects" value={cues.length} />
            <StatTile label="Duration" value={formatDuration(duration)} />
            <StatTile label="Active cue" value={activeCue ? activeCue.firework.name : '—'} />
          </div>

          <Card elevation="low" radius="md" className="space-y-4 p-5">
            <Eyebrow tone="muted">Upcoming cues</Eyebrow>
            {upcomingCues.length > 0 ? (
              <ol className="space-y-2">
                {upcomingCues.map((cue) => (
                  <li
                    key={cue.id}
                    className="bg-surface-container-highest/60 flex items-start justify-between gap-3 rounded-lg p-3"
                  >
                    <div>
                      <p className="text-on-surface text-sm font-semibold">
                        {cue.description || cue.firework.name}
                      </p>
                      {cue.description && (
                        <p className="text-on-surface-variant mt-1 line-clamp-2 text-xs">
                          {cue.firework.name}
                        </p>
                      )}
                    </div>
                    <span className="text-tertiary font-mono text-xs tabular-nums">
                      {formatDuration(cue.timeSeconds)}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-on-surface-variant text-sm leading-relaxed">
                No upcoming typed cues at this playhead position.
              </p>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
