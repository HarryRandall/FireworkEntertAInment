'use client';

/** Retry boundary for the catalogue list and product pages. The shared browse
 *  boundary is worded for Explore, so catalogue failures name the catalogue. */

import { RouteError } from '@/ui/patterns/RouteError';

export default function CatalogueError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <RouteError title="Catalogue failed to load" onRetry={retry} className="min-h-[50vh] flex-none">
      We could not load the firework catalogue. Try again in a moment.
    </RouteError>
  );
}
