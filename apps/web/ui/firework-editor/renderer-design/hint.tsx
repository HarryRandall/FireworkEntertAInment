/** Registry tooltip composition for contextual help and disabled actions. */
'use client';
import type { ReactElement } from 'react';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/ui/primitives/tooltip';
/** Makes contextual help available on hover and focus, including for disabled children. */
export function Hint({
  children,
  label,
  disabled = false,
}: {
  children: ReactElement;
  label: string;
  disabled?: boolean;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {disabled ? (
            <span tabIndex={0} className="inline-flex">
              {children}
            </span>
          ) : (
            children
          )}
        </TooltipTrigger>
        <TooltipContent side="top" avoidCollisions>
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
