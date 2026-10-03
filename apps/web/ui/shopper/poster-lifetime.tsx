/** Owns the shared thumbnail context for one public browsing surface. */
'use client';
import { useEffect } from 'react';
import { disposePosters } from '@showcrafter/fireworks/view';
/** Releases queued poster resources when public store browsing ends. */
export function PosterLifetime() {
  useEffect(
    () => () => {
      disposePosters().catch((error: unknown) => {
        console.error('Poster cleanup failed', error);
      });
    },
    [],
  );
  return null;
}
