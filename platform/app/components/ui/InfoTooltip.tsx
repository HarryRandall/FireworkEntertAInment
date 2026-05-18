import type { ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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
          suppressHydrationWarning
          aria-label="More information"
          className={cn(
            "inline-flex h-4 w-4 items-center justify-center rounded-full border border-[color:var(--color-border-default)] bg-[color:var(--color-bg-default)] text-[color:var(--color-content-subtle)] transition-colors hover:border-[color:var(--color-border-emphasis)] hover:text-[color:var(--color-content-emphasis)]",
            className,
          )}
        >
          <span className="block text-[10px] leading-none italic">i</span>
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={6}
        className="max-w-56 rounded-md border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)] px-3 py-2 text-xs text-[color:var(--color-content-default)] shadow-[var(--shadow-modal)]"
      >
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
