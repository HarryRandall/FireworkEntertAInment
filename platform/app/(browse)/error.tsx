'use client';

/** Safe retry boundary for guest and authenticated public browse routes. */

import { RotateCcw } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { InlineAlert } from '@/app/components/ui/Feedback';

export default function BrowseError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] w-full items-start justify-center px-4 py-8">
      <div className="flex w-full max-w-xl flex-col items-start gap-3">
        <InlineAlert tone="danger" title="Explore failed to load" className="w-full">
          We could not load the latest shows or catalogue data. Try again in a moment.
        </InlineAlert>
        <Button type="button" onClick={reset} variant="secondary" size="md">
          <RotateCcw size={16} />
          Retry
        </Button>
      </div>
    </div>
  );
}
