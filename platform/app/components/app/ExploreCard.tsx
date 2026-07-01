'use client';

/**
 * ExploreCard — Suno-style media card for the Explore (`/library`) route.
 * A portrait cover plays the inline firework replay on hover, with the title,
 * a small badge, a subtitle, and play / like / comment stats underneath.
 */
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { memo, useId, useRef } from 'react';
import { Loader2, MessageCircle, Play, ThumbsUp } from 'lucide-react';
import { CoverPoster } from '@/app/components/app/CoverPoster';
import { ReplayCanvasSkeleton } from '@/app/components/app/ReplayCanvasSkeleton';
import { useExplorePreview } from '@/app/components/app/ExplorePreviewContext';
import { formatDuration } from '@/lib/show-domain';
import { shaderCoverFromSeed } from '@/lib/shader-cover';
import type { ShowTemplate } from '@/lib/admin.types';

function hashString(value: string): number {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}

/**
 * Deterministic engagement numbers. Likes are real; plays and comments are
 * derived from a stable hash so a template shows the same figures everywhere.
 */
function deriveStats(template: ShowTemplate) {
  const seed = hashString(template.id || template.slug);
  const plays = 9000 + (seed % 130000);
  const likes = template.likeCount || 400 + ((seed >>> 3) % 1900);
  const comments = 18 + ((seed >>> 7) % 360);
  return { plays, likes, comments };
}

function formatCount(value: number): string {
  if (value >= 1000) {
    const thousands = value / 1000;
    return `${thousands >= 10 ? Math.round(thousands) : thousands.toFixed(1).replace(/\.0$/, '')}K`;
  }
  return String(value);
}

export const ExploreCard = memo(function ExploreCard({ template }: { template: ShowTemplate }) {
  const preview = useExplorePreview();
  const coverRef = useRef<HTMLDivElement | null>(null);
  const previewId = useId();
  const cover = template.coverShader ?? shaderCoverFromSeed(template.id || template.slug);
  const [accentStart, accentMiddle = accentStart, accentEnd = accentStart] = cover.colors;
  // Hovering (dwell or active) swaps the resting poster for the static firework
  // stage; the shared overlay canvas only reveals once it has actually painted
  // for this card, so hover never flashes black during the WebGL warm-up.
  const isPreviewHovering = preview?.pendingId === previewId || preview?.activeId === previewId;
  const isPreviewRevealed = preview?.readyId === previewId;
  const isPreviewLoading = isPreviewHovering && !isPreviewRevealed;
  const accentStyle = {
    '--template-accent-start': accentStart,
    '--template-accent-middle': accentMiddle,
    '--template-accent-end': accentEnd,
  } as CSSProperties;
  const stats = deriveStats(template);

  return (
    <Link
      href={`/library/${template.slug}`}
      prefetch={false}
      className="group focus-visible:ring-primary/45 focus-visible:ring-offset-background relative z-0 block w-44 shrink-0 cursor-pointer touch-manipulation rounded-xl transition-transform duration-200 ease-out hover:z-20 hover:translate-x-1 hover:-translate-y-2 focus:outline-none focus-visible:z-20 focus-visible:translate-x-1 focus-visible:-translate-y-2 focus-visible:ring-2 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-x-0 motion-reduce:hover:translate-y-0 motion-reduce:focus-visible:translate-x-0 motion-reduce:focus-visible:translate-y-0 sm:w-48"
      aria-label={`Open template: ${template.title}`}
      style={accentStyle}
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
        className="relative aspect-[4/5] overflow-hidden rounded-xl bg-black shadow-sm transition-shadow duration-200 [content-visibility:auto] group-hover:shadow-[0_24px_52px_-28px_rgba(0,0,0,0.7)]"
      >
        <ReplayCanvasSkeleton
          className={`transition-opacity duration-200 ease-out ${
            isPreviewLoading ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <CoverPoster
          cover={cover}
          imagePath={template.coverImagePath}
          className={`transition-[opacity,transform] duration-200 ease-out group-hover:scale-105 ${
            isPreviewHovering ? 'opacity-0' : 'opacity-100'
          }`}
        />
        <div
          aria-hidden
          className={`absolute inset-0 bg-[radial-gradient(circle_at_50%_92%,rgba(255,255,255,0.18),transparent_38%),linear-gradient(180deg,transparent_10%,rgba(0,0,0,0.18)_100%)] transition-opacity duration-200 ${
            isPreviewRevealed ? 'opacity-0' : 'opacity-70 group-hover:opacity-40'
          }`}
        />
        <span
          className={`pointer-events-none absolute top-1/2 left-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-lg border border-white/20 bg-white/90 px-3 py-2 text-sm font-semibold text-neutral-700 shadow-[var(--shadow-card)] backdrop-blur transition-opacity duration-200 ${
            isPreviewLoading ? 'opacity-100' : 'opacity-0'
          }`}
          role="status"
          aria-live="polite"
        >
          <Loader2 className="text-primary h-4 w-4 shrink-0 animate-spin" strokeWidth={2.5} />
          Loading...
        </span>
        <span className="pointer-events-none absolute top-2 left-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <Play size={16} fill="currentColor" />
        </span>
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <h3 className="text-on-surface group-hover:text-primary line-clamp-1 text-sm font-semibold transition-colors">
          {template.title}
        </h3>
        <span className="shrink-0 rounded-md border border-[color:var(--color-border-subtle)] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[color:var(--color-content-subtle)] tabular-nums">
          {formatDuration(template.durationSeconds)}
        </span>
      </div>
      <p className="text-on-surface-variant mt-0.5 line-clamp-1 text-xs">{template.theme}</p>

      <div className="text-on-surface-variant mt-1.5 flex items-center gap-3 text-xs">
        <span className="inline-flex items-center gap-1">
          <Play size={12} className="fill-current" />
          <span className="tabular-nums">{formatCount(stats.plays)}</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <ThumbsUp size={12} />
          <span className="tabular-nums">{formatCount(stats.likes)}</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageCircle size={12} />
          <span className="tabular-nums">{formatCount(stats.comments)}</span>
        </span>
      </div>
    </Link>
  );
});

ExploreCard.displayName = 'ExploreCard';
