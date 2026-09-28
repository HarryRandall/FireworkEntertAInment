'use client';

/** Error boundary for my-store routes. */

import { RouteError } from '@/ui/patterns/RouteError';

export default function RetailerAdminError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <RouteError title="My Store failed to load" onRetry={retry}>
      Something went wrong while loading this workspace. Try again in a moment.
    </RouteError>
  );
}
