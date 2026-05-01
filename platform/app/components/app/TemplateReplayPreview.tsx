"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { FireworkReplayCanvas } from "@/app/components/app/FireworkReplayCanvas";
import type { ShowTemplate, ShowTemplateCue } from "@/lib/platform.types";
import type { FireworkSpecification, ReplayCue } from "@/lib/shows";
import { formatDuration } from "@/lib/shows";

type TemplateReplayPreviewProps = {
  template: ShowTemplate;
  specifications: FireworkSpecification[];
  mode?: "card" | "detail";
  isCardHovered?: boolean;
};

function posterTimeFor(template: ShowTemplate): number {
  if (template.previewCues.length === 0) return 0;
  let hash = 0;
  for (const char of template.slug) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const cue = template.previewCues[hash % template.previewCues.length];
  return Math.max(0, cue.timeSeconds + 1.6);
}

function hoverStartTimeFor(template: ShowTemplate): number {
  const firstCueTime = template.previewCues.reduce<number | null>(
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
  const firework = specBySlug.get(cue.fireworkSlug);
  if (!firework) return null;
  return {
    id: `${cue.fireworkSlug}-${cue.timeSeconds}-${index}`,
    position: index + 1,
    timeSeconds: cue.timeSeconds,
    description: cue.description,
    fireworkSpecificationId: firework.id,
    renderParams: null,
    firework,
  };
}

export function TemplateReplayPreview({
  template,
  specifications,
  mode = "card",
  isCardHovered = false,
}: TemplateReplayPreviewProps) {
  const duration = Math.max(template.durationSeconds ?? 30, 30);
  const posterTime = useMemo(() => posterTimeFor(template), [template]);
  const hoverStartTime = useMemo(() => hoverStartTimeFor(template), [template]);
  const [elapsed, setElapsed] = useState(posterTime);
  const [isPlaying, setIsPlaying] = useState(false);
  const elapsedRef = useRef(elapsed);
  const startedAt = useRef<number | null>(null);
  const playheadStart = useRef(0);
  const isDetail = mode === "detail";
  const active = isDetail ? isPlaying : isCardHovered;
  const playbackRate = isDetail ? 1 : 1.15;

  const cues = useMemo(() => {
    const specBySlug = new Map(specifications.map((spec) => [spec.slug, spec]));
    return template.previewCues
      .map((cue, index) => toReplayCue(cue, index, specBySlug))
      .filter((cue): cue is ReplayCue => Boolean(cue))
      .sort((a, b) => a.timeSeconds - b.timeSeconds);
  }, [specifications, template.previewCues]);

  useEffect(() => {
    elapsedRef.current = elapsed;
  }, [elapsed]);

  useEffect(() => {
    if (isDetail) return;
    setElapsed(isCardHovered ? hoverStartTime : posterTime);
  }, [hoverStartTime, isCardHovered, isDetail, posterTime]);

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

  return (
    <div
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
      <div className={isDetail ? "h-[min(58vh,560px)] min-h-[380px]" : "h-full"}>
        <FireworkReplayCanvas
          cues={cues}
          elapsed={elapsed}
          interactive={isDetail}
        />
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
