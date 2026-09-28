'use client';

/** Error boundary for admin routes. */

import { RouteError } from '@/ui/patterns/RouteError';

export default function AdminError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <RouteError title="Admin data failed to load" onRetry={retry}>
      Something went wrong while loading the admin workspace. Try again in a moment.
    </RouteError>
  );
}
