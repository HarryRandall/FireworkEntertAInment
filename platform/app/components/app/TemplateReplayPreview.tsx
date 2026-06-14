'use client';

/**
 * TemplateReplayPreview — small 3D replay preview used on template
 * cards in the library route and on the template detail page. In
 * "card" mode only the first ~10 seconds simulate to keep the initial
 * seek cheap when many cards are visible.
 */
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Heart, Pause, Play, RotateCcw } from 'lucide-react';
import type { ShowTemplate, ShowTemplateCue } from '@/lib/admin.types';
import type { FireworkSpecification, ReplayCue } from '@/lib/show-domain';
import { formatBudget, formatDuration } from '@/lib/show-domain';

type TemplateReplayPreviewProps = {
  template: ShowTemplate;
  specifications: FireworkSpecification[];
  mode?: 'card' | 'detail';
  isCardHovered?: boolean;
};

const FIREWORK_SLUG_ALIASES: Record<string, string> = {
  chrysanthemum: 'gold-chrysanthemum',
  comet: 'comet-gold',
  finale_barrage: 'white-strobe',
  peony: 'gold-chrysanthemum',
  willow: 'willow-gold',
};

// Card previews only simulate this window — keeps initial seek fast.
const CARD_PREVIEW_SECONDS = 10;

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

function posterTimeFor(slug: string, cues: ShowTemplateCue[]): number {
  if (cues.length === 0) return 0;
  let hash = 0;
  for (const char of slug) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const cue = cues[hash % cues.length];
  return Math.max(0, cue.timeSeconds + 1.6);
}

function hoverStartTimeFor(cues: ShowTemplateCue[]): number {
  const firstCueTime = cues.reduce<number | null>(
    (earliest, cue) => (earliest == null ? cue.timeSeconds : Math.min(earliest, cue.timeSeconds)),
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
    specBySlug.get(FIREWORK_SLUG_ALIASES[cue.fireworkSlug] ?? '');
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
  mode = 'card',
  isCardHovered = false,
}: TemplateReplayPreviewProps) {
  const isDetail = mode === 'detail';

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

  const duration = isDetail ? Math.max(template.durationSeconds ?? 30, 30) : CARD_PREVIEW_SECONDS;

  const posterTime = useMemo(
    () => posterTimeFor(template.slug, visibleCues),
    [template.slug, visibleCues],
  );
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
    if (!element || typeof IntersectionObserver === 'undefined') {
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
      { rootMargin: '160px' },
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
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
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
    playheadStart.current = elapsedRef.current >= duration ? 0 : elapsedRef.current;

    function tick(now: number) {
      if (startedAt.current == null) return;
      const next = playheadStart.current + ((now - startedAt.current) / 1000) * playbackRate;
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
          ? 'border-outline-variant/15 relative overflow-hidden rounded-xl border bg-black'
          : 'relative h-44 overflow-hidden'
      }
      style={isDetail ? undefined : { backgroundImage: 'var(--preview-card-bg)' }}
    >
      <div className={isDetail ? 'relative h-[min(62vh,620px)] min-h-[420px]' : 'relative h-full'}>
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
      {isDetail ? (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-36 bg-gradient-to-t from-black/85 via-black/45 to-transparent" />
          <div className="absolute right-4 bottom-4 left-4 z-20">
            <div className="rounded-xl border border-white/15 bg-black/60 px-3 py-3 text-white shadow-[var(--shadow-modal)] backdrop-blur-md sm:rounded-full sm:px-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={togglePlayback}
                    disabled={cues.length === 0}
                    aria-label={isPlaying ? 'Pause template preview' : 'Play template preview'}
                    className="focus-glow-action flex h-11 w-11 items-center justify-center rounded-full bg-white text-black shadow-[var(--shadow-cta)] transition-all hover:bg-white/90 focus:outline-none focus-visible:outline-none active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/25 disabled:text-white/40 disabled:shadow-none"
                  >
                    {isPlaying ? <Pause size={17} /> : <Play size={17} fill="currentColor" />}
                  </button>
                  <button
                    type="button"
                    onClick={restart}
                    aria-label="Restart template preview"
                    className="focus-glow-action flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white transition-all hover:bg-white/12 focus:outline-none focus-visible:outline-none active:scale-[0.98]"
                  >
                    <RotateCcw size={15} />
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex justify-between font-mono text-[11px] text-white/75 tabular-nums">
                    <span>{formatDuration(elapsed)}</span>
                    <span>{formatDuration(duration)}</span>
                  </div>
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
                    className="h-1.5 w-full cursor-pointer accent-white"
                    aria-label="Template preview timeline"
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="pointer-events-none absolute top-3 right-3 z-10 rounded-lg border border-white/15 bg-black/45 px-2.5 py-1.5 text-right text-xs text-white shadow-sm backdrop-blur transition-all duration-200 group-hover:-translate-y-1 group-hover:opacity-0 group-focus-visible:-translate-y-1 group-focus-visible:opacity-0">
            <span className="inline-flex items-center justify-end gap-1">
              <Heart size={14} className="fill-current text-[color:var(--destructive)]" />
              <span className="tabular-nums">{template.likeCount}</span>
            </span>
            <span className="block font-mono tabular-nums">
              {formatBudget(template.totalCents)}
            </span>
          </div>
          <div
            className={
              isCardHovered
                ? 'pointer-events-none absolute inset-x-0 bottom-0 h-[15%] translate-y-full bg-[linear-gradient(90deg,var(--template-accent-start),var(--template-accent-middle),var(--template-accent-end))] [mask-image:linear-gradient(to_top,black_0%,rgba(0,0,0,0.5)_28%,transparent_72%)] opacity-0 transition-all duration-[1800ms] [transition-timing-function:cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none'
                : 'pointer-events-none absolute inset-x-0 bottom-0 h-[15%] translate-y-0 bg-[linear-gradient(90deg,var(--template-accent-start),var(--template-accent-middle),var(--template-accent-end))] [mask-image:linear-gradient(to_top,black_0%,rgba(0,0,0,0.5)_28%,transparent_72%)] opacity-70 transition-all duration-500 ease-in-out motion-reduce:transition-none'
            }
          />
        </>
      )}
    </div>
  );
}
