'use client';

/** Error boundary for public marketing pages. */

import { RouteError } from '@/ui/patterns/RouteError';

export default function MarketingError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <RouteError title="This page failed to load" onRetry={retry} className="min-h-[50vh] flex-none">
      Something went wrong while loading this page. Try again in a moment.
    </RouteError>
  );
}
