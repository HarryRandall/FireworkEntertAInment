'use client';

import Link from 'next/link';
import { CircleAlert, Loader2, Play } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { Skeleton } from '@/app/components/ui/Feedback';
import { useFireworkBrowsePreview } from '@/app/components/app/FireworkBrowsePreviewContext';
import { cn } from '@/lib/utils';

type FireworkBrowseCardProps = {
  previewId: string;
  previewUrl: string;
  label: string;
  href?: string;
  children: ReactNode;
  className?: string;
  persistedPosterUrl?: string | null;
  persistPoster?: boolean;
};

function PreviewState({ loading, failed }: { loading: boolean; failed: boolean }) {
  if (failed) {
    return (
      <span
        className="flex items-center gap-2 rounded-md border border-white/15 bg-black/65 px-3 py-2 text-xs font-medium text-white shadow-sm"
        role="status"
      >
        <CircleAlert size={15} aria-hidden />
        Preview unavailable
      </span>
    );
  }
  if (loading) {
    return (
      <span
        className="flex items-center gap-2 rounded-md border border-white/15 bg-black/65 px-3 py-2 text-xs font-medium text-white shadow-sm"
        role="status"
        aria-live="polite"
      >
        <Loader2 size={15} className="animate-spin motion-reduce:animate-none" aria-hidden />
        Loading preview
      </span>
    );
  }
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white shadow-sm transition-colors group-focus-within:bg-black/75 group-hover:bg-black/75 group-focus-visible:bg-black/75">
      <Play size={15} fill="currentColor" aria-hidden />
      <span className="sr-only">Preview</span>
    </span>
  );
}

export function FireworkBrowseCard({
  previewId,
  previewUrl,
  label,
  href,
  children,
  className,
  persistedPosterUrl = null,
  persistPoster = false,
}: FireworkBrowseCardProps) {
  const browsePreview = useFireworkBrowsePreview();
  const mediaRef = useRef<HTMLDivElement | null>(null);
  const posterRef = useRef<HTMLImageElement | null>(null);
  const sessionPosterUrl = browsePreview?.posterUrls.get(previewUrl) ?? null;
  const posterUrl = sessionPosterUrl ?? persistedPosterUrl;
  const [loadedPosterUrl, setLoadedPosterUrl] = useState<string | null>(null);
  const [failedPosterUrl, setFailedPosterUrl] = useState<string | null>(null);
  const isActive = browsePreview?.activeId === previewId;
  const isReady = browsePreview?.readyId === previewId;
  const isFailed = browsePreview?.failedId === previewId;
  const isLoading = Boolean(isActive && !isReady && !isFailed);
  const posterLoaded = Boolean(posterUrl && loadedPosterUrl === posterUrl);
  const shouldPersistPoster =
    persistPoster && (!persistedPosterUrl || failedPosterUrl === persistedPosterUrl);
  const queuePosterCapture = browsePreview?.queuePosterCapture;
  const unqueuePosterCapture = browsePreview?.unqueuePosterCapture;

  useEffect(() => {
    const image = posterRef.current;
    if (!posterUrl || !image?.complete) return;

    if (image.naturalWidth > 0) {
      setFailedPosterUrl((current) => (current === posterUrl ? null : current));
      setLoadedPosterUrl(posterUrl);
    } else {
      setLoadedPosterUrl((current) => (current === posterUrl ? null : current));
      setFailedPosterUrl(posterUrl);
    }
  }, [posterUrl]);

  useEffect(() => {
    if (!shouldPersistPoster || !mediaRef.current) return;

    queuePosterCapture?.(previewId, previewUrl, mediaRef.current);
    return () => unqueuePosterCapture?.(previewId);
  }, [previewId, previewUrl, queuePosterCapture, shouldPersistPoster, unqueuePosterCapture]);

  const startPreview = () => {
    if (!mediaRef.current) return;
    browsePreview?.requestPreview(previewId, previewUrl, mediaRef.current, {
      persist: shouldPersistPoster,
    });
  };
  const stopPreview = () => browsePreview?.releasePreview(previewId);
  const handlePointerEnter = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'touch') startPreview();
  };
  const handlePointerLeave = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'touch') stopPreview();
  };

  const media = (
    <div
      ref={mediaRef}
      className="bg-stage-night relative aspect-[16/10] overflow-hidden border-b border-[color:var(--color-border-subtle)]"
    >
      {/* Shimmer only while a real poster is loading. Cards without a
          persisted poster show the stage backdrop, not a permanent skeleton. */}
      {posterUrl && failedPosterUrl !== posterUrl && !posterLoaded ? (
        <Skeleton className="absolute inset-0 h-full w-full rounded-none" aria-hidden />
      ) : null}
      {posterUrl && failedPosterUrl !== posterUrl ? (
        // Public Storage and Blob URLs do not use the Next.js image optimiser.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={posterRef}
          src={posterUrl}
          alt=""
          aria-hidden
          draggable={false}
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-300 group-focus-within:scale-[1.025] group-hover:scale-[1.025] group-focus-visible:scale-[1.025] motion-reduce:transition-none',
            posterLoaded ? 'opacity-100' : 'opacity-0',
          )}
          onLoad={() => {
            setFailedPosterUrl((current) => (current === posterUrl ? null : current));
            setLoadedPosterUrl(posterUrl);
          }}
          onError={() => {
            setLoadedPosterUrl((current) => (current === posterUrl ? null : current));
            setFailedPosterUrl(posterUrl);
          }}
        />
      ) : null}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 z-10 flex items-end justify-end p-3 transition-opacity duration-150',
          isReady && 'opacity-0',
        )}
      >
        <PreviewState loading={isLoading} failed={Boolean(isFailed)} />
      </div>
    </div>
  );

  const cardClasses = cn(
    'group border-border bg-card text-card-foreground min-w-0 overflow-hidden rounded-xl border shadow-xs transition-[border-color,box-shadow,transform] duration-200 hover:border-[color:var(--color-border-strong)] hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-within:ring-2 focus-within:ring-primary/45 focus-within:ring-offset-2 focus-within:ring-offset-background motion-reduce:transition-none',
    className,
  );

  if (href) {
    return (
      <Link
        href={href}
        prefetch={false}
        aria-label={`Open ${label}`}
        className={cn('block', cardClasses)}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onFocus={startPreview}
        onBlur={stopPreview}
      >
        {media}
        {children}
      </Link>
    );
  }

  return (
    <article
      className={cardClasses}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <div className="relative">
        {media}
        <button
          type="button"
          aria-label={`${isActive ? 'Stop' : 'Preview'} ${label}`}
          className="absolute inset-0 z-20 rounded-t-xl focus:outline-none"
          onFocus={startPreview}
          onBlur={stopPreview}
          onClick={() => {
            if (!mediaRef.current) return;
            browsePreview?.togglePreview(previewId, previewUrl, mediaRef.current, {
              persist: shouldPersistPoster,
            });
          }}
        />
      </div>
      {children}
    </article>
  );
}

export function FireworkBrowseGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="border-border bg-card overflow-hidden rounded-xl border">
          <Skeleton className="aspect-[16/10] w-full rounded-none" />
          <div className="space-y-3 p-4">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
