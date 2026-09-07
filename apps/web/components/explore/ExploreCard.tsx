'use client';

/**
 * ExploreCard — Suno-style media card for the Explore (`/library`) route.
 * A portrait cover plays the inline firework replay on hover, with the title,
 * a small badge, a subtitle, and factual show stats underneath.
 */
import Link from 'next/link';
import { memo, useId, useRef } from 'react';
import { Heart, Loader2, Play, Sparkles, Wallet } from 'lucide-react';
import { CoverPoster } from '@/components/covers/CoverPoster';
import { ReplayCanvasSkeleton } from '@/components/replay/ReplayCanvasSkeleton';
import { useExplorePreview } from '@/components/explore/ExplorePreviewContext';
import { formatBudget, formatDuration } from '@/lib/show-domain';
import { cn } from '@/lib/utils';
import type { ShowTemplateSummary } from '@/lib/show-template-summary';

function formatCount(value: number): string {
  if (value >= 1000) {
    const thousands = value / 1000;
    return `${thousands >= 10 ? Math.round(thousands) : thousands.toFixed(1).replace(/\.0$/, '')}K`;
  }
  return String(value);
}

export const ExploreCard = memo(function ExploreCard({
  template,
  className,
}: {
  template: ShowTemplateSummary;
  /** Width override: shelves use the default fixed width, grids pass w-full. */
  className?: string;
}) {
  const preview = useExplorePreview();
  const coverRef = useRef<HTMLDivElement | null>(null);
  const previewId = useId();
  const titleId = `${previewId}-title`;
  const durationId = `${previewId}-duration`;
  const themeId = `${previewId}-theme`;
  const statsId = `${previewId}-stats`;
  // The intent delay and WebGL warm-up leave the saved poster in place. It only
  // yields once the shared canvas has painted a frame for this exact card.
  const isPreviewActive = preview?.activeId === previewId;
  const isPreviewRevealed = preview?.readyId === previewId;
  const isPreviewLoading =
    preview?.pendingId === previewId || (isPreviewActive && !isPreviewRevealed);
  return (
    <Link
      href={`/library/${template.slug}`}
      prefetch={false}
      className={cn(
        'group focus-visible:ring-primary/45 focus-visible:ring-offset-background relative z-0 block w-44 shrink-0 cursor-pointer touch-manipulation rounded-xl transition-transform duration-200 ease-out hover:z-20 hover:translate-x-1 hover:-translate-y-2 focus:outline-none focus-visible:z-20 focus-visible:translate-x-1 focus-visible:-translate-y-2 focus-visible:ring-2 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-x-0 motion-reduce:hover:translate-y-0 motion-reduce:focus-visible:translate-x-0 motion-reduce:focus-visible:translate-y-0 sm:w-48',
        className,
      )}
      aria-labelledby={titleId}
      aria-describedby={`${durationId} ${themeId} ${statsId}`}
      onPointerEnter={() => {
        if (coverRef.current) preview?.requestPreview(previewId, coverRef.current, template);
      }}
      onPointerLeave={() => preview?.releasePreview(previewId)}
      onFocus={() => {
        if (coverRef.current) preview?.requestPreview(previewId, coverRef.current, template);
      }}
      onBlur={() => preview?.releasePreview(previewId)}
    >
      <div
        ref={coverRef}
        // No content-visibility here: skipped-then-painted covers made whole
        // rows flash in as they scrolled into the render band. Each poster now
        // holds its own skeleton until the image decodes.
        className="relative aspect-[4/5] overflow-hidden rounded-xl bg-black shadow-sm transition-shadow duration-200 group-hover:shadow-[0_24px_52px_-28px_rgba(0,0,0,0.7)]"
      >
        <ReplayCanvasSkeleton
          className={`transition-opacity duration-200 ease-out ${
            isPreviewLoading ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <CoverPoster
          imagePath={template.coverImagePath}
          fallbackCover={template.coverShader}
          className={`transition-[opacity,transform] duration-200 ease-out group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none ${
            isPreviewRevealed ? 'opacity-0' : 'opacity-100'
          }`}
        />
        <span
          className={`pointer-events-none absolute top-1/2 left-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-lg border border-white/20 bg-white/90 px-3 py-2 text-sm font-semibold text-neutral-700 shadow-[var(--shadow-card)] backdrop-blur transition-opacity duration-200 ${
            isPreviewLoading ? 'opacity-100' : 'opacity-0'
          }`}
          aria-hidden="true"
        >
          <Loader2
            aria-hidden="true"
            className="text-primary h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none"
            strokeWidth={2.5}
          />
          Loading…
        </span>
        <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {isPreviewLoading ? 'Loading template preview…' : ''}
        </span>
        <span className="pointer-events-none absolute top-2 left-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none">
          <Play aria-hidden="true" size={16} fill="currentColor" />
        </span>
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <h3
          id={titleId}
          className="text-on-surface group-hover:text-primary line-clamp-1 text-sm font-semibold transition-colors"
        >
          {template.title}
        </h3>
        <span
          id={durationId}
          className="shrink-0 rounded-md border border-[color:var(--color-border-subtle)] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[color:var(--color-content-subtle)] tabular-nums"
        >
          <span className="sr-only">Duration </span>
          {formatDuration(template.durationSeconds)}
        </span>
      </div>
      <p id={themeId} className="text-on-surface-variant mt-0.5 line-clamp-1 text-xs">
        {template.theme}
      </p>

      <div id={statsId} className="text-on-surface-variant mt-1.5 flex items-center gap-3 text-xs">
        <span className="inline-flex items-center gap-1">
          <Heart aria-hidden="true" size={12} />
          <span aria-hidden="true" className="tabular-nums">
            {formatCount(template.likeCount)}
          </span>
          <span className="sr-only">
            {template.likeCount.toLocaleString()} {template.likeCount === 1 ? 'like' : 'likes'}
          </span>
        </span>
        <span className="inline-flex items-center gap-1">
          <Sparkles aria-hidden="true" size={12} />
          <span aria-hidden="true" className="tabular-nums">
            {template.effectsCount}
          </span>
          <span className="sr-only">
            {template.effectsCount} {template.effectsCount === 1 ? 'effect' : 'effects'}
          </span>
        </span>
        <span className="inline-flex items-center gap-1">
          <Wallet aria-hidden="true" size={12} />
          <span aria-hidden="true" className="tabular-nums">
            {formatBudget(template.totalCents)}
          </span>
          <span className="sr-only">Estimated retail {formatBudget(template.totalCents)}</span>
        </span>
      </div>
    </Link>
  );
});

ExploreCard.displayName = 'ExploreCard';
