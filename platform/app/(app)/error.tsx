'use client';

/** Error boundary for the `(app)` route group; renders a retry UI when a page throws. */

import { RotateCcw } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { InlineAlert } from '@/app/components/ui/Feedback';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] w-full items-center justify-center py-8">
      <div className="flex w-full max-w-3xl flex-col items-center gap-6">
        <InlineAlert
          tone="danger"
          size="lg"
          title="This workspace view failed to load"
          className="w-full"
        >
          {error.message ||
            'Try again. If the issue persists, check the latest import or profile changes.'}
        </InlineAlert>
        <Button type="button" onClick={reset} variant="secondary" size="lg" className="text-base">
          <RotateCcw size={20} />
          Retry
        </Button>
      </div>
    </div>
  );
}
