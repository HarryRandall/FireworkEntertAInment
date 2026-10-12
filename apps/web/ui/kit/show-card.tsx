/** Planned show summary with a 3D still and a read-only energy profile. */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const PERCENT = 100; // Normalised energy values are displayed as CSS percentages.

/** A poster still on the night stage, or its preparing and failed states. */
export function PosterImage({
  url,
  error,
  alt = '',
  className,
}: {
  url?: string | null;
  error?: string;
  alt?: string;
  className?: string;
}) {
  const frame = cn('bg-stage-night block aspect-[4/3] w-full', className);
  if (error !== undefined) {
    return (
      <span
        role="status"
        className={cn(frame, 'text-stage-glass-muted flex items-center justify-center p-3 text-xs')}
      >
        {error}
      </span>
    );
  }
  if (!url) {
    return (
      <span className={cn(frame, 'animate-pulse')}>
        <span className="sr-only">Preparing 3D poster</span>
      </span>
    );
  }
  // Posters may be browser-generated blob URLs, which cannot use image optimisation.
  // eslint-disable-next-line @next/next/no-img-element -- blob and storage posters need a native image.
  return <img src={url} alt={alt} className={cn(frame, 'object-cover')} />;
}

/** Presents one planned show; energy values are normalised to 0 to 1. */
export function PlannedShowCard({
  title,
  description,
  price,
  duration,
  itemCount,
  energy,
  tags,
  poster,
  className,
}: {
  title: string;
  description: string;
  price: string;
  duration: string;
  itemCount: number;
  energy: readonly number[];
  tags: readonly string[];
  /** The still or live preview shown above the details. */
  poster: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={cn(
        'border-border bg-card shadow-card grid min-w-0 overflow-hidden rounded-xl border text-left',
        className,
      )}
    >
      {poster}
      <div className="grid gap-2 p-4">
        <h3 className="text-foreground text-base font-semibold">{title}</h3>
        <p className="text-muted-foreground text-xs">{description}</p>
        <div aria-hidden="true" className="flex h-7 items-end gap-0.5">
          {energy.map((level, index) => (
            <span
              key={index}
              style={{ height: `${Math.max(0, Math.min(1, level)) * PERCENT}%` }}
              className="bg-hl/70 min-h-0.5 flex-1 rounded-t-sm"
            />
          ))}
        </div>
        <p className="text-muted-foreground flex flex-wrap gap-3 text-xs">
          <b className="text-foreground tabular-nums">{price}</b>
          <span>{duration}</span>
          <span>{itemCount} items</span>
        </p>
        <ul className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <li
              key={tag}
              className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium"
            >
              {tag}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
