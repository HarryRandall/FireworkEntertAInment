'use client';

import Link from 'next/link';
import { memo, useRef } from 'react';
import { BadgeDollarSign, Clock3, ListMusic, Play } from 'lucide-react';
import { CoverPoster } from '@/app/components/app/CoverPoster';
import { ReplayCanvasSkeleton } from '@/app/components/app/ReplayCanvasSkeleton';
import type { ShowSummaryCard } from '@/lib/show-summary';
import { formatBudget, formatDuration } from '@/lib/show-domain';
import { cn } from '@/lib/utils';
import { useShowReplayPreview } from './ShowReplayPreviewContext';

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

export const ShowReplayCoverCard = memo(function ShowReplayCoverCard({
  show,
}: {
  show: ShowSummaryCard;
}) {
  const preview = useShowReplayPreview();
  const coverRef = useRef<HTMLDivElement | null>(null);
  const isPreviewHovering = preview?.pendingId === show.id || preview?.activeId === show.id;
  const isPreviewRevealed = preview?.readyId === show.id;

  function requestPreview() {
    if (coverRef.current) preview?.requestPreview(show.id, coverRef.current, show);
  }

  function releasePreview() {
    preview?.releasePreview(show.id);
  }

  return (
    <Link
      href={`/shows/${show.slug}/preview`}
      prefetch={false}
      aria-label={`Open ${show.title}`}
      className="group focus-visible:ring-primary/45 focus-visible:ring-offset-background block min-w-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      onPointerEnter={requestPreview}
      onPointerLeave={releasePreview}
      onFocus={requestPreview}
      onBlur={releasePreview}
    >
      <div
        ref={coverRef}
        className="relative aspect-[4/5] overflow-hidden rounded-xl bg-black shadow-sm transition-shadow duration-200 [content-visibility:auto] group-hover:shadow-[0_18px_42px_-30px_rgba(0,0,0,0.68)]"
      >
        {isPreviewHovering ? (
          <ReplayCanvasSkeleton
            showLoadingBar={!isPreviewRevealed}
            loadingBarPosition="center"
            loadingBarVariant="compact"
            className={cn(
              'transition-opacity duration-200 ease-out',
              isPreviewRevealed ? 'opacity-0' : 'opacity-100',
            )}
          />
        ) : null}
        <CoverPoster
          imagePath={show.coverImagePath}
          className={cn(
            'transition-[opacity,transform] duration-200 ease-out group-hover:scale-105',
            isPreviewHovering ? 'opacity-0' : 'opacity-100',
          )}
        />
        <span className="pointer-events-none absolute top-2 left-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
          <Play size={16} fill="currentColor" />
        </span>
        <span className="absolute top-2 right-2 z-10 rounded-full bg-black/55 px-2.5 py-1 font-mono text-[10px] font-medium text-white/90 tabular-nums">
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
          <span
            className="inline-flex items-center gap-1"
            title="Estimated retail cost of fireworks"
          >
            <BadgeDollarSign size={12} />
            <span className="tabular-nums">{formatBudget(show.totalCostCents)}</span>
          </span>
        </div>
      </div>
    </Link>
  );
});

ShowReplayCoverCard.displayName = 'ShowReplayCoverCard';
