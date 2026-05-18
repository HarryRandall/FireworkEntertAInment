"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import type { ShowTemplate, ShowTemplateCue } from "@/lib/admin.types";
import type { FireworkSpecification, ReplayCue } from "@/lib/show-domain";
import { formatDuration } from "@/lib/show-domain";

type TemplateReplayPreviewProps = {
  template: ShowTemplate;
  specifications: FireworkSpecification[];
  mode?: "card" | "detail";
  isCardHovered?: boolean;
};

const FIREWORK_SLUG_ALIASES: Record<string, string> = {
  chrysanthemum: "gold-chrysanthemum",
  comet: "comet-gold",
  finale_barrage: "white-strobe",
  peony: "gold-chrysanthemum",
  willow: "willow-gold",
};

// Card previews only simulate this window — keeps initial seek fast.
const CARD_PREVIEW_SECONDS = 10;

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

function posterTimeFor(slug: string, cues: ShowTemplateCue[]): number {
  if (cues.length === 0) return 0;
  let hash = 0;
  for (const char of slug) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const cue = cues[hash % cues.length];
  return Math.max(0, cue.timeSeconds + 1.6);
}

function hoverStartTimeFor(cues: ShowTemplateCue[]): number {
  const firstCueTime = cues.reduce<number | null>(
    (earliest, cue) =>
      earliest == null ? cue.timeSeconds : Math.min(earliest, cue.timeSeconds),
    null,
  );
  return Math.max(0, (firstCueTime ?? 0) - 0.75);
}

function toReplayCue(
  cue: ShowTemplateCue,
  index: number,
  specBySlug: Map<string, FireworkSpecification>,
): ReplayCue | null {
  const firework =
    specBySlug.get(cue.fireworkSlug) ??
    specBySlug.get(FIREWORK_SLUG_ALIASES[cue.fireworkSlug] ?? "");
  if (!firework) return null;
  return {
    id: `${cue.fireworkSlug}-${cue.timeSeconds}-${index}`,
    position: index + 1,
    timeSeconds: cue.timeSeconds,
    description: cue.description,
    productId: firework.id,
    launchPositionIndex: index % 3,
    firework,
  };
}

export function TemplateReplayPreview({
  template,
  specifications,
  mode = "card",
  isCardHovered = false,
}: TemplateReplayPreviewProps) {
  const isDetail = mode === "detail";

  // In card mode, only simulate the first CARD_PREVIEW_SECONDS of the show.
  // This keeps poster seeks and hover playback near-instant regardless of
  // how long the full template is.
  const visibleCues = useMemo(
    () =>
      isDetail
        ? template.previewCues
        : template.previewCues.filter((c) => c.timeSeconds <= CARD_PREVIEW_SECONDS),
    [isDetail, template.previewCues],
  );

  const duration = isDetail
    ? Math.max(template.durationSeconds ?? 30, 30)
    : CARD_PREVIEW_SECONDS;

  const posterTime = useMemo(() => posterTimeFor(template.slug, visibleCues), [template.slug, visibleCues]);
  const hoverStartTime = useMemo(() => hoverStartTimeFor(visibleCues), [visibleCues]);
  const [elapsed, setElapsed] = useState(posterTime);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isVisible, setIsVisible] = useState(isDetail);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const elapsedRef = useRef(elapsed);
  const hoverStartTimeRef = useRef(hoverStartTime);
  const startedAt = useRef<number | null>(null);
  const playheadStart = useRef(0);
  const detailAutoplayRef = useRef(false);
  const active = isDetail ? isPlaying : isCardHovered;
  const playbackRate = isDetail ? 1 : 1.15;

  const cues = useMemo(() => {
    const specBySlug = new Map(specifications.map((spec) => [spec.slug, spec]));
    return visibleCues
      .map((cue, index) => toReplayCue(cue, index, specBySlug))
      .filter((cue): cue is ReplayCue => Boolean(cue))
      .sort((a, b) => a.timeSeconds - b.timeSeconds);
  }, [specifications, visibleCues]);

  useEffect(() => {
    elapsedRef.current = elapsed;
  }, [elapsed]);

  useEffect(() => {
    if (isDetail || isVisible) return;
    const element = containerRef.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "160px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [isDetail, isVisible]);

  useEffect(() => {
    hoverStartTimeRef.current = hoverStartTime;
  }, [hoverStartTime]);

  useEffect(() => {
    if (isDetail) return;
    setElapsed(isCardHovered ? hoverStartTime : posterTime);
  }, [hoverStartTime, isCardHovered, isDetail, posterTime]);

  useEffect(() => {
    detailAutoplayRef.current = false;
  }, [template.slug]);

  useEffect(() => {
    if (!isDetail || cues.length === 0 || detailAutoplayRef.current) return;
    detailAutoplayRef.current = true;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setElapsed(hoverStartTimeRef.current);
      setIsPlaying(false);
      return;
    }
    setElapsed(0);
    setIsPlaying(true);
  }, [isDetail, cues.length]);

  useEffect(() => {
    if (!active || cues.length === 0) return;
    let frame = 0;
    startedAt.current = performance.now();
    playheadStart.current =
      elapsedRef.current >= duration ? 0 : elapsedRef.current;

    function tick(now: number) {
      if (startedAt.current == null) return;
      const next =
        playheadStart.current +
        ((now - startedAt.current) / 1000) * playbackRate;
      if (next >= duration) {
        if (isDetail) {
          setElapsed(duration);
          setIsPlaying(false);
          return;
        }
        startedAt.current = now;
        playheadStart.current = 0;
        setElapsed(0);
      } else {
        setElapsed(next);
      }
      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, cues.length, duration, isDetail, playbackRate]);

  function togglePlayback() {
    if (elapsed >= duration) setElapsed(0);
    setIsPlaying((playing) => !playing);
  }

  function restart() {
    setIsPlaying(false);
    setElapsed(0);
  }

  const shouldMountCanvas = isDetail || isVisible || isCardHovered;

  return (
    <div
      ref={containerRef}
      className={
        isDetail
          ? "overflow-hidden rounded-xl border border-outline-variant/15 bg-surface-container-low"
          : "relative h-52 overflow-hidden"
      }
      style={
        isDetail
          ? undefined
          : { backgroundImage: "var(--preview-card-bg)" }
      }
    >
      <div className={isDetail ? "relative h-[min(58vh,560px)] min-h-[380px]" : "relative h-full"}>
        {shouldMountCanvas ? (
          <LazyFireworkReplayCanvas
            cues={cues}
            elapsed={elapsed}
            interactive={isDetail}
            muted={isDetail ? !isPlaying : true}
          />
        ) : (
          <ReplayCanvasSkeleton />
        )}
      </div>
      {!isDetail ? (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-20"
          style={{ backgroundImage: "var(--preview-card-fade)" }}
        />
      ) : (
        <div className="border-t border-outline-variant/15 bg-surface-container-low/90 p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlayback}
                disabled={cues.length === 0}
                aria-label={isPlaying ? "Pause template preview" : "Play template preview"}
                className="focus-glow-action flex h-11 w-11 items-center justify-center rounded-full bg-primary-container text-on-primary-container shadow-[var(--shadow-cta)] transition-all focus:outline-none focus-visible:outline-none hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant/40 disabled:shadow-none"
              >
                {isPlaying ? <Pause size={17} /> : <Play size={17} />}
              </button>
              <button
                type="button"
                onClick={restart}
                aria-label="Restart template preview"
                className="focus-glow-action flex h-10 w-10 items-center justify-center rounded-full border border-outline/20 text-primary transition-all focus:outline-none focus-visible:outline-none hover:bg-surface-container-highest/50 active:scale-[0.98]"
              >
                <RotateCcw size={15} />
              </button>
            </div>
            <div className="flex-1">
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
                className="h-2 w-full accent-tertiary"
                aria-label="Template preview timeline"
              />
              <div className="mt-2 flex justify-between font-mono text-[11px] text-tertiary/80 tabular-nums">
                <span>{formatDuration(elapsed)}</span>
                <span>{formatDuration(duration)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
