'use client';

/** Safe retry boundary for guest and authenticated public browse routes. */

import { RouteError } from '@/ui/patterns/RouteError';

export default function BrowseError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <RouteError title="Explore failed to load" onRetry={retry} className="min-h-[50vh] flex-none">
      We could not load the latest shows or catalogue data. Try again in a moment.
    </RouteError>
  );
}
