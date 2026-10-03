/** Planned show summary with a 3D still and a read-only energy profile. */
'use client';
import { Badge } from './feedback';
import { PosterImage } from './product-picker';

const PERCENT = 100; // Normalised energy values are displayed as CSS percentages.
/** Presents one planned show and an explicit choose action; energy values are normalised. */
export function PlannedShowCard({
  title,
  description,
  price,
  duration,
  itemCount,
  energy,
  tags,
  poster,
  posterError,
  selected,
  onSelect,
}: {
  title: string;
  description: string;
  price: string;
  duration: string;
  itemCount: number;
  energy: readonly number[];
  tags: readonly string[];
  poster?: string;
  posterError?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className="border-border bg-card aria-pressed:border-highlight aria-pressed:ring-highlight grid min-w-0 overflow-hidden rounded-xl border text-left aria-pressed:ring-1"
    >
      <PosterImage url={poster} error={posterError} />
      <span className="grid gap-2 p-4">
        <b className="text-lg font-semibold">{title}</b>
        <span className="text-muted-foreground text-xs">{description}</span>
        <span aria-hidden="true" className="flex h-7 items-end gap-0.5">
          {energy.map((level, index) => (
            <span
              key={index}
              style={{ height: `${String(Math.max(0, Math.min(1, level)) * PERCENT)}%` }}
              className="bg-highlight/70 min-h-0.5 flex-1 rounded-t-sm"
            />
          ))}
        </span>
        <span className="text-muted-foreground flex flex-wrap gap-3 text-xs">
          <b className="text-foreground">{price}</b>
          <span>{duration}</span>
          <span>{itemCount} items</span>
        </span>
        <span className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <Badge key={tag}>{tag}</Badge>
          ))}
        </span>
      </span>
    </button>
  );
}
