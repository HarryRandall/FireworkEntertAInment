'use client';

/** Error boundary for admin routes. */

import { RotateCcw } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { InlineAlert } from '@/app/components/ui/Feedback';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] w-full flex-1 items-start justify-center px-4 py-8">
      <div className="flex w-full max-w-xl flex-col items-start gap-3">
        <InlineAlert tone="danger" title="Admin data failed to load" className="w-full">
          {error.message ||
            'Retry the request. If it continues, check database permissions and the latest migration.'}
        </InlineAlert>
        <Button type="button" onClick={reset} variant="secondary" size="md">
          <RotateCcw size={16} />
          Retry
        </Button>
      </div>
    </div>
  );
}
