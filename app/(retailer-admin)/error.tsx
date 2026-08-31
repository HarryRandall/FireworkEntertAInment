'use client';

/** Error boundary for retailer-admin routes. */

import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/design-system/Button';
import { InlineAlert } from '@/components/design-system/Feedback';

export default function RetailerAdminError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] w-full flex-1 items-start justify-center px-4 py-8">
      <div className="flex w-full max-w-xl flex-col items-start gap-3">
        <InlineAlert tone="danger" title="Retailer admin failed to load" className="w-full">
          Something went wrong while loading this workspace. Try again in a moment.
        </InlineAlert>
        <Button type="button" onClick={reset} variant="secondary" size="md">
          <RotateCcw size={16} />
          Retry
        </Button>
      </div>
    </div>
  );
}
