'use client';

/**
 * CoverPoster - static cover art for browse cards. Renders only the
 * pre-rendered image from the `covers` bucket.
 *
 * The neutral skeleton holds the card shape until that one image decodes. When
 * no image path is supplied, the skeleton remains visible so missing posters do
 * not fall back to shader-derived colours.
 */
import { useEffect, useMemo, useState } from 'react';
import { Skeleton } from '@/app/components/ui/Feedback';
import { coverPosterUrl } from '@/lib/cover-poster-url';
import { cn } from '@/lib/utils';

export function CoverPoster({
  imagePath,
  alt = '',
  className,
  eager = false,
}: {
  /** Storage path in the `covers` bucket; null/undefined keeps the skeleton visible. */
  imagePath?: string | null;
  alt?: string;
  /** Extra classes for the root element (position, opacity, hover scale, etc.). */
  className?: string;
  /** Load the image eagerly (e.g. above-the-fold hero cards). */
  eager?: boolean;
}) {
  const src = useMemo(() => coverPosterUrl(imagePath), [imagePath]);
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
      {!loaded ? <Skeleton className="absolute inset-0 h-full w-full rounded-none" /> : null}
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
