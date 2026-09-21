/** InfoTooltip - compact shadcn-style info icon with hover/focus help. */
import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Tooltip as TooltipPrimitive } from 'radix-ui';
import { Tooltip, TooltipTrigger } from '@/ui/primitives/tooltip';
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
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          sideOffset={6}
          collisionPadding={12}
          className="bg-background text-foreground border-border z-50 max-w-[15rem] rounded-md border px-3 py-1.5 text-xs leading-snug shadow-md"
        >
          {text}
          <TooltipPrimitive.Arrow asChild width={14} height={7}>
            <svg
              width="14"
              height="7"
              viewBox="0 0 14 7"
              aria-hidden
              className="fill-background stroke-border overflow-visible"
            >
              <path d="M0 -1 L7 6 L14 -1" strokeWidth="1" strokeLinejoin="round" />
            </svg>
          </TooltipPrimitive.Arrow>
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </Tooltip>
  );
}
