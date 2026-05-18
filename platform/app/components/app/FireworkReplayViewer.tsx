"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Pause, Play, Plus, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import {
  addPreviewCueAction,
  deletePreviewCueAction,
  type CueActionResult,
} from "@/app/actions/preview-cues";
import { Badge, Eyebrow } from "@/app/components/ui/Badge";
import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { Input } from "@/app/components/ui/Input";
import { NumberInput } from "@/app/components/ui/NumberInput";
import { SelectField } from "@/app/components/ui/SelectField";
import { StatTile } from "@/app/components/ui/StatTile";
import type { FireworkSpecification, ReplayCue } from "@/lib/show-domain";
import { formatDuration } from "@/lib/show-domain";
import type { LaunchPosition } from "@/lib/fireworks/design";

type FireworkReplayViewerProps = {
  showId: string;
  showSlug: string;
  showName: string;
  durationSeconds: number | null;
  cues: ReplayCue[];
  specifications: FireworkSpecification[];
  launchPositions: LaunchPosition[];
};

const LAUNCH_POSITION_OPTIONS = [
  { value: "0", label: "Mortar 1 (left)" },
  { value: "1", label: "Mortar 2 (centre)" },
  { value: "2", label: "Mortar 3 (right)" },
];

function ReplayCanvasSkeleton() {
  return (
    <div className="absolute inset-0 h-full w-full animate-pulse bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.12),transparent_28%),linear-gradient(180deg,#05070d,#101522)]" />
  );
}

const LazyFireworkReplayCanvas = dynamic(
  () =>
    import("@/app/components/app/FireworkReplayCanvas").then(
      (mod) => mod.FireworkReplayCanvas,
    ),
  {
    ssr: false,
    loading: () => <ReplayCanvasSkeleton />,
  },
);

function EmptyPreview() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8 text-center">
      <div className="max-w-md rounded-2xl border border-outline-variant/15 bg-surface-container-low/85 p-6 backdrop-blur">
        <Sparkles className="mx-auto mb-4 text-primary" size={28} />
        <h3 className="text-xl font-bold text-on-surface">
          No typed fireworks yet
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
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
}: FireworkReplayViewerProps) {
  const inferredDuration =
    cues.length > 0 ? Math.max(...cues.map((cue) => cue.timeSeconds)) + 5 : 30;
  const duration = Math.max(durationSeconds ?? inferredDuration, inferredDuration);
  const [elapsed, setElapsed] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [actionResult, setActionResult] = useState<CueActionResult | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | undefined>(specifications[0]?.id);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const startedAt = useRef<number | null>(null);
  const playheadStart = useRef(0);
  const elapsedRef = useRef(elapsed);

  useEffect(() => {
    elapsedRef.current = elapsed;
  }, [elapsed]);

  useEffect(() => {
    if (!isPlaying) return;
    let frame = 0;
    startedAt.current = performance.now();
    playheadStart.current = elapsedRef.current;

    function tick(now: number) {
      if (startedAt.current == null) return;
      const next = Math.min(
        duration,
        playheadStart.current + (now - startedAt.current) / 1000,
      );
      setElapsed(next);
      if (next >= duration) {
        setIsPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, isPlaying]);

  const sortedCues = useMemo(
    () => [...cues].sort((a, b) => a.timeSeconds - b.timeSeconds),
    [cues],
  );

  // Collapse expanded shots back to one row per show_cue for the builder list.
  // Multi-shot IDs are "{baseCueId}-shot-N"; single-shot IDs are just the UUID.
  const builderCues = useMemo(() => {
    const seen = new Map<string, { cue: ReplayCue; baseCueId: string; shotCount: number }>();
    for (const cue of sortedCues) {
      const baseCueId = cue.id.replace(/-shot-\d+$/, "");
      if (!seen.has(baseCueId)) {
        seen.set(baseCueId, { cue, baseCueId, shotCount: 1 });
      } else {
        seen.get(baseCueId)!.shotCount += 1;
      }
    }
    return Array.from(seen.values());
  }, [sortedCues]);

  const activeCue = useMemo(() => {
    return [...sortedCues]
      .reverse()
      .find((cue) => cue.timeSeconds <= elapsed + 0.35);
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
    formData.set("cueId", cueId);
    formData.set("showSlug", showSlug);
    startTransition(async () => {
      setActionResult(await deletePreviewCueAction(formData));
    });
  }

  return (
    <div className="space-y-6">
      <Card
        elevation="low"
        radius="lg"
        className="overflow-hidden bg-gradient-to-b from-surface-container-high via-surface-container to-surface-container-low p-0 shadow-[var(--shadow-card-hover)]"
      >
        <div className="relative h-[min(72vh,680px)] min-h-[520px]">
          <div className="absolute left-6 top-6 z-10 space-y-2">
            <Badge tone={isPlaying ? "live" : "neutral"}>
              {isPlaying ? "Live replay" : "Interactive preview"}
            </Badge>
            <h2 className="max-w-xl text-3xl font-extrabold tracking-tight text-on-surface md:text-4xl">
              {showName}
            </h2>
            <p className="max-w-sm text-xs font-medium text-on-surface-variant">
              Drag to orbit. Scroll to zoom. Use the timeline to scrub.
            </p>
          </div>

          <LazyFireworkReplayCanvas
            cues={sortedCues}
            elapsed={elapsed}
            launchPositions={launchPositions}
            muted={!isPlaying}
          />

          {!hasReplayCues ? <EmptyPreview /> : null}
        </div>

        <div className="border-t border-outline-variant/15 bg-surface-container-low/90 px-5 py-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={togglePlayback}
              disabled={!hasReplayCues}
              aria-label={isPlaying ? "Pause preview" : "Play preview"}
              className="focus-glow-action flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container shadow-[var(--shadow-cta)] transition-all focus:outline-none focus-visible:outline-none hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant/40 disabled:shadow-none"
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
              className="focus-glow-action flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-outline/20 text-primary transition-all focus:outline-none focus-visible:outline-none hover:bg-surface-container-highest/50 active:scale-[0.98]"
            >
              <RotateCcw size={16} strokeWidth={2} />
            </button>

            <div className="flex flex-1 items-center gap-3">
              <span className="font-mono text-[11px] tabular-nums text-tertiary/80 min-w-[2.75rem]">
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
                className="h-2 flex-1 accent-tertiary"
                aria-label="Preview timeline"
              />
              <span className="font-mono text-[11px] tabular-nums text-tertiary/80 min-w-[2.75rem] text-right">
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
              <h3 className="mt-2 text-2xl font-bold text-on-surface">
                Add or remove fireworks
              </h3>
            </div>
            {actionResult ? (
              <p
                className={
                  actionResult.ok
                    ? "text-sm font-semibold text-primary"
                    : "text-sm font-semibold text-error"
                }
              >
                {actionResult.ok ? actionResult.message : actionResult.error}
              </p>
            ) : null}
          </div>

          <form
            ref={formRef}
            action={addCue}
            className="grid grid-cols-1 gap-3 rounded-xl border border-outline-variant/15 bg-surface-container-low p-4 md:grid-cols-[1fr_120px_140px_1.4fr_auto] md:items-end"
          >
            <input type="hidden" name="showId" value={showId} />
            <input type="hidden" name="showSlug" value={showSlug} />
            <label className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
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
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                Mortar
              </span>
              <SelectField
                name="launchPositionIndex"
                defaultValue="1"
                options={LAUNCH_POSITION_OPTIONS}
              />
            </label>
            <label className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
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
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                Label
              </span>
              <Input
                key={selectedProductId}
                name="description"
                defaultValue={specifications.find((s) => s.id === selectedProductId)?.name ?? ""}
                required
              />
            </label>
            <Button
              type="submit"
              disabled={isPending || specifications.length === 0}
            >
              <Plus size={16} strokeWidth={2} />
              Add
            </Button>
          </form>

          <div className="space-y-3">
            {builderCues.length > 0 ? (
              builderCues.map(({ cue, baseCueId, shotCount }) => (
                <div
                  key={baseCueId}
                  className="flex flex-col gap-3 rounded-xl border border-outline-variant/10 bg-surface-container-highest/60 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono text-sm font-bold text-tertiary tabular-nums">
                        {formatDuration(cue.timeSeconds)}
                      </span>
                      <span className="font-semibold text-on-surface">
                        {cue.description || cue.firework.name}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                        {LAUNCH_POSITION_OPTIONS[cue.launchPositionIndex]?.label ?? `Mortar ${cue.launchPositionIndex + 1}`}
                      </span>
                      {shotCount > 1 && (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                          {shotCount} shots
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteCue(baseCueId)}
                    disabled={isPending}
                    className="focus-glow-action inline-flex h-10 items-center justify-center gap-2 rounded-full border border-outline/20 px-4 text-sm font-semibold text-on-surface-variant transition-all focus:outline-none focus-visible:outline-none hover:bg-surface-container-high hover:text-error disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 size={15} strokeWidth={2} />
                    Remove
                  </button>
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-outline-variant/15 bg-surface-container-low p-4 text-sm text-on-surface-variant">
                No cues yet. Add your first firework above to make the preview
                playable.
              </p>
            )}
          </div>
        </Card>

        <aside className="space-y-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <StatTile label="Total effects" value={cues.length} />
            <StatTile label="Duration" value={formatDuration(duration)} />
            <StatTile
              label="Active cue"
              value={activeCue ? activeCue.firework.name : "—"}
            />
          </div>

          <Card elevation="high" radius="md" className="space-y-4 p-5">
            <Eyebrow tone="muted">Firework types</Eyebrow>
            <div className="space-y-3">
              {specifications.map((spec) => (
                <div
                  key={spec.id}
                  className="rounded-lg border border-outline-variant/10 bg-surface-container-highest/70 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-on-surface">
                      {spec.name}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                      {spec.slug}
                    </span>
                  </div>
                  {spec.description ? (
                    <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                      {spec.description}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>

          <Card elevation="low" radius="md" className="space-y-4 p-5">
            <Eyebrow tone="muted">Upcoming cues</Eyebrow>
            {upcomingCues.length > 0 ? (
              <ol className="space-y-2">
                {upcomingCues.map((cue) => (
                  <li
                    key={cue.id}
                    className="flex items-start justify-between gap-3 rounded-lg bg-surface-container-highest/60 p-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-on-surface">
                        {cue.description || cue.firework.name}
                      </p>
                      {cue.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-on-surface-variant">
                          {cue.firework.name}
                        </p>
                      )}
                    </div>
                    <span className="font-mono text-xs text-tertiary tabular-nums">
                      {formatDuration(cue.timeSeconds)}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm leading-relaxed text-on-surface-variant">
                No upcoming typed cues at this playhead position.
              </p>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
