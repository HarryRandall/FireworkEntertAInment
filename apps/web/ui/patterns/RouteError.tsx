/** Retry panel rendered by route-group `error.tsx` boundaries. */

import { RotateCcw } from 'lucide-react';
import { Button } from '@/ui/patterns/Button';
import { InlineAlert } from '@/ui/patterns/Feedback';
import { cn } from '@/lib/utils';

export function RouteError({
  title,
  children,
  onRetry,
  className,
}: {
  title: string;
  children: React.ReactNode;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex min-h-[calc(100vh-8rem)] w-full flex-1 items-start justify-center px-4 py-8',
        className,
      )}
    >
      <div className="flex w-full max-w-xl flex-col items-start gap-3">
        <InlineAlert tone="danger" title={title} className="w-full">
          {children}
        </InlineAlert>
        <Button type="button" onClick={onRetry} variant="secondary" size="md">
          <RotateCcw size={16} aria-hidden="true" />
          Retry
        </Button>
      </div>
    </div>
  );
}
