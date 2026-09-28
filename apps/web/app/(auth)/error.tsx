'use client';

/** Error boundary for sign-in and sign-up pages. */

import { RouteError } from '@/ui/patterns/RouteError';

export default function AuthError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <RouteError
      title="Sign-in is unavailable"
      onRetry={retry}
      className="min-h-screen items-center"
    >
      Something went wrong while loading this page. Try again in a moment.
    </RouteError>
  );
}
