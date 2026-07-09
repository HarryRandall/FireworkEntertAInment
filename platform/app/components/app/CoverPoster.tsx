'use client';

/**
 * CoverPoster - static cover art for browse cards. Renders a pre-rendered PNG
 * from the `covers` bucket over the cheap CSS gradient fallback
 * ({@link shaderCoverGradient}). Replaces the live WebGL `ShaderCover` on
 * thumbnail surfaces so browse pages do not mount a WebGL context per card.
 *
 * The CSS gradient paints instantly (no WebGL, no network), then the PNG fades
 * in once decoded. When no image path is supplied (e.g. not yet rendered), the
 * gradient remains as the cover.
 */
import { useEffect, useMemo, useState } from 'react';
import { coverGradient, type ShowCover } from '@/lib/cover';
import { coverPosterUrl } from '@/lib/cover-poster-url';
import { cn } from '@/lib/utils';

export function CoverPoster({
  cover,
  imagePath,
  alt = '',
  className,
  eager = false,
}: {
  cover: ShowCover;
  /** Storage path in the `covers` bucket; null/undefined falls back to the gradient. */
  imagePath?: string | null;
  alt?: string;
  /** Extra classes for the root element (position, opacity, hover scale, etc.). */
  className?: string;
  /** Load the image eagerly (e.g. above-the-fold hero cards). */
  eager?: boolean;
}) {
  const gradient = useMemo(() => coverGradient(cover), [cover]);
  const src = coverPosterUrl(imagePath);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!src) setLoaded(false);
  }, [src]);

  return (
    <div
      className={cn('absolute inset-0 h-full w-full overflow-hidden', className)}
      style={{ background: gradient }}
    >
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
          onLoad={() => setLoaded(true)}
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-200',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
        />
      ) : null}
    </div>
  );
}
