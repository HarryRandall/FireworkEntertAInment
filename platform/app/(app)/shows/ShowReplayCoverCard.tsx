'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BadgeDollarSign, Clock3, ListMusic, Play } from 'lucide-react';
import { ShaderCover } from '@/app/components/app/ShaderCover';
import { Skeleton } from '@/app/components/ui/Feedback';
import type { ShowSummaryCard } from '@/lib/show-summary';
import type { ReplayCue } from '@/lib/show-domain';
import { formatBudget, formatDuration } from '@/lib/show-domain';
import { shaderCoverFromSeed } from '@/lib/shader-cover';
import { cn } from '@/lib/utils';

const LazyFireworkReplayCanvas = dynamic(
  () => import('@/app/components/app/FireworkReplayCanvas').then((mod) => mod.FireworkReplayCanvas),
  {
    ssr: false,
    loading: () => <Skeleton className="h-full w-full rounded-none" />,
  },
);

const CARD_PREVIEW_WINDOW_SECONDS = 12;

function formatEditedAt(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function showMeta(show: ShowSummaryCard) {
  return [show.songTitle ?? 'Untitled track', show.style].filter(Boolean).join(' · ');
}

function previewStartFor(cues: ReplayCue[]) {
  const firstCue = cues[0]?.timeSeconds ?? 0;
  return Math.max(0, firstCue - 0.75);
}

export function ShowReplayCoverCard({ show, cues }: { show: ShowSummaryCard; cues: ReplayCue[] }) {
  const cover = show.coverShader ?? shaderCoverFromSeed(show.id || show.slug);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [elapsed, setElapsed] = useState(() => previewStartFor(cues));
  const elapsedRef = useRef(elapsed);
  const active = hovered || focused;
  const previewStart = useMemo(() => previewStartFor(cues), [cues]);
  const duration = Math.max(show.lengthSeconds ?? 30, cues.at(-1)?.timeSeconds ?? 0, 10);
  const previewEnd = Math.min(duration, previewStart + CARD_PREVIEW_WINDOW_SECONDS);
  const shouldShowReplay = active && cues.length > 0;

  useEffect(() => {
    if (!active) {
      elapsedRef.current = previewStart;
      setElapsed(previewStart);
    }
  }, [active, previewStart]);

  useEffect(() => {
    if (!shouldShowReplay) return;

    let frame = 0;
    let startedAt = performance.now();
    let playheadStart = elapsedRef.current;

    function tick(now: number) {
      const next = playheadStart + (now - startedAt) / 1000;
      if (next >= previewEnd) {
        startedAt = now;
        playheadStart = previewStart;
        elapsedRef.current = previewStart;
        setElapsed(previewStart);
      } else {
        elapsedRef.current = next;
        setElapsed(next);
      }
      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [previewEnd, previewStart, shouldShowReplay]);

  return (
    <Link
      href={`/shows/${show.slug}/preview`}
      prefetch
      aria-label={`Open ${show.title}`}
      className="group focus-visible:ring-primary/45 focus-visible:ring-offset-background block min-w-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-[color:var(--color-bg-elevated)] shadow-sm transition-shadow duration-200 group-hover:shadow-[0_18px_42px_-30px_rgba(0,0,0,0.68)]">
        <ShaderCover
          cover={cover}
          animate={active}
          showSkeletonUntilReady
          className={cn(
            'transition-all duration-500 ease-out group-hover:scale-105',
            shouldShowReplay ? 'opacity-0' : 'opacity-100',
          )}
        />
        {shouldShowReplay ? (
          <div className="pointer-events-none absolute inset-0">
            <LazyFireworkReplayCanvas
              cues={cues}
              elapsed={elapsed}
              playbackRef={elapsedRef}
              interactive={false}
              muted
              maxDevicePixelRatio={1}
            />
          </div>
        ) : null}
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_50%_92%,rgba(255,255,255,0.18),transparent_38%),linear-gradient(180deg,rgba(0,0,0,0.04)_0%,rgba(0,0,0,0.48)_100%)] opacity-80 transition-opacity duration-200 group-hover:opacity-55"
        />
        <span className="pointer-events-none absolute top-2 left-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
          <Play size={16} fill="currentColor" />
        </span>
        <span className="absolute top-2 right-2 z-10 rounded-full bg-black/42 px-2.5 py-1 font-mono text-[10px] font-medium text-white/90 tabular-nums backdrop-blur">
          {formatEditedAt(show.lastEditedAt)}
        </span>
      </div>

      <div className="mt-2.5 min-w-0">
        <h2 className="text-on-surface group-hover:text-primary line-clamp-1 text-sm font-semibold transition-colors">
          {show.title}
        </h2>
        <span className="text-on-surface-variant mt-0.5 line-clamp-1 block text-xs">
          {showMeta(show)}
        </span>

        <div className="text-on-surface-variant mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
          <span className="inline-flex items-center gap-1">
            <Clock3 size={12} />
            <span className="tabular-nums">{formatDuration(show.lengthSeconds)}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <ListMusic size={12} />
            <span className="tabular-nums">{show.cueCount}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <BadgeDollarSign size={12} />
            <span className="tabular-nums">{formatBudget(show.totalCostCents)}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
