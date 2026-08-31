'use client';

/**
 * CoverPoster - static cover art for browse cards. Renders only the
 * pre-rendered image from the `covers` bucket.
 *
 * The neutral skeleton holds the card shape until an available image decodes.
 * Older rows without a poster use the saved cover's cheap CSS gradient so
 * public cards remain identifiable without mounting a WebGL context per card.
 */
import { useEffect, useMemo, useState } from 'react';
import { Skeleton } from '@/components/design-system/Feedback';
import { coverGradient, type ShowCover } from '@/lib/cover';
import { coverPosterUrl } from '@/lib/cover-poster-url';
import { cn } from '@/lib/utils';

export function CoverPoster({
  imagePath,
  fallbackCover,
  alt = '',
  className,
  eager = false,
}: {
  /** Storage path in the `covers` bucket; null/undefined uses the fallback below. */
  imagePath?: string | null;
  /** Saved cover used as a static CSS-only fallback while no poster exists. */
  fallbackCover?: ShowCover | null;
  alt?: string;
  /** Extra classes for the root element (position, opacity, hover scale, etc.). */
  className?: string;
  /** Load the image eagerly (e.g. above-the-fold hero cards). */
  eager?: boolean;
}) {
  const src = useMemo(() => coverPosterUrl(imagePath), [imagePath]);
  const fallbackBackground = useMemo(
    () => (fallbackCover ? coverGradient(fallbackCover) : null),
    [fallbackCover],
  );
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const loaded = Boolean(src && loadedSrc === src);

  useEffect(() => {
    if (!src) setLoadedSrc(null);
  }, [src]);

  return (
    <div
      className={cn(
        'bg-muted absolute inset-0 h-full w-full overflow-hidden rounded-[inherit]',
        className,
      )}
    >
      {!src && fallbackBackground ? (
        <div
          aria-hidden="true"
          className="absolute inset-0 h-full w-full"
          style={{ background: fallbackBackground }}
        />
      ) : !loaded ? (
        <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
      ) : null}
      {src ? (
        // Static CDN asset; next/image is not used to keep the public-URL path
        // simple and avoid an extra loader for a tiny poster.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          width={384}
          height={480}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setLoadedSrc(src)}
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-200',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
        />
      ) : null}
    </div>
  );
}
