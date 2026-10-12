'use client';

/** Three product-sized stills; the keys match curated effects so the stills come from cache. */
import { useState } from 'react';
import { effectTemplates } from '@showcrafter/renderer';
import { PosterImage } from '@/ui/kit/show-card';
import { useLandingPosters, useNearViewport } from './useLandingPosters';

const TILES = ['peony', 'willow', 'crossette'].flatMap((key) => {
  const template = effectTemplates.find((entry) => entry.key === key);
  return template ? [{ key, name: template.name, design: template.design }] : [];
});

export function CatalogueTiles() {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const posters = useLandingPosters(TILES, useNearViewport(element));
  return (
    <div ref={setElement} className="grid grid-cols-3 gap-1.5">
      {TILES.map((tile) => (
        <div key={tile.key} className="grid min-w-0 gap-1">
          <PosterImage
            url={posters.urls[tile.key]}
            error={posters.failed[tile.key] ? 'Unavailable' : undefined}
            className="aspect-square rounded-md"
          />
          <span className="text-muted-foreground truncate text-[11px]">{tile.name}</span>
        </div>
      ))}
    </div>
  );
}
