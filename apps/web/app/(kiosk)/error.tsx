'use client';

/** Error boundary for public assortment (QR code) pages. */

import { RouteError } from '@/ui/patterns/RouteError';

export default function KioskError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <RouteError
      title="This page failed to load"
      onRetry={retry}
      className="min-h-[calc(100dvh-4rem)]"
    >
      Something went wrong while loading this assortment. Try again, or ask the retailer for help.
    </RouteError>
  );
}
