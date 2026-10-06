'use client';
import type { ReactElement } from 'react';
import type { Design } from '@showcrafter/renderer';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/ui/primitives/tooltip';
import { DesignPreview } from './preview';
const HOVER_DELAY_MS = 250; // Reference editor hover-intent delay in milliseconds.
/** Shows an isolated, disposable preview without changing the authored document. */
export function HoverPreview({
  document,
  name,
  children,
}: {
  document: Design | null;
  name: string;
  children: ReactElement;
  climb?: boolean;
  address?: string;
}) {
  if (!document) return children;
  return (
    <TooltipProvider delayDuration={HOVER_DELAY_MS}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent aria-label={`${name} preview`} className="w-64" side="right">
          <div className="h-48">
            <DesignPreview document={document} player={false} loop />
          </div>
          <p>{name}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
