/** Template choices and progressive thumbnails for renderer comparison. */
'use client';
import Image from 'next/image';
import { entries } from './review-catalogue';
import { THUMB_WIDTH_PX, THUMB_HEIGHT_PX } from './review-viewer-lifecycle';
/** Renders template choices; selecting a card reuses the main viewer. */
export function TemplateLibrary({
  selected,
  ready,
  posters,
  select,
}: {
  selected: (typeof entries)[number];
  ready: boolean;
  posters: Record<string, string>;
  select: (entry: (typeof entries)[number]) => void;
}) {
  return (
    <section
      aria-label="Template library"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      {entries.map((entry) => (
        <button
          key={entry.key}
          type="button"
          data-template={entry.key}
          data-poster-status={(posters[entry.key] ?? '').length > 0 ? 'ready' : 'pending'}
          disabled={!ready}
          aria-pressed={selected.key === entry.key}
          aria-label={`Play ${entry.name}`}
          onClick={() => {
            select(entry);
          }}
          className="bg-card text-card-foreground focus-visible:ring-ring aria-pressed:border-primary overflow-hidden rounded-xl border text-left focus-visible:ring-2"
        >
          {(posters[entry.key] ?? '').length > 0 ? (
            <Image
              unoptimized
              src={posters[entry.key]}
              alt=""
              width={THUMB_WIDTH_PX}
              height={THUMB_HEIGHT_PX}
              className="aspect-[16/10] w-full"
            />
          ) : (
            <div className="bg-muted aspect-[16/10]" />
          )}
          <span className="grid gap-1 p-3">
            <span className="font-medium">{entry.name}</span>
            <span className="text-muted-foreground text-sm">{entry.group}</span>
          </span>
        </button>
      ))}
    </section>
  );
}
