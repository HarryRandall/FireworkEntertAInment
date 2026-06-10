/** InfoTooltip - compact shadcn-style info icon with hover/focus help. */
import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type InfoTooltipProps = {
  text: ReactNode;
  className?: string;
};

export function InfoTooltip({ text, className }: InfoTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="More information"
          className={cn(
            'text-muted-foreground focus-visible:ring-ring/50 focus-visible:ring-offset-background inline-flex size-4 items-center justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            className,
          )}
        >
          <Info className="size-3" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}
