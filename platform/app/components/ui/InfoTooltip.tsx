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
            "inline-flex h-5 w-5 items-center justify-center rounded-full border border-outline-variant/70 bg-surface text-on-surface-variant transition-colors hover:border-outline hover:text-on-surface focus:outline-none focus-visible:border-outline focus-visible:text-on-surface",
            className,
          )}
        >
          <span className="block font-serif text-[12px] leading-none italic">
            i
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={8}
        className="w-56 rounded-lg bg-surface-container-highest px-3 py-2 text-xs font-medium normal-case tracking-normal text-on-surface-variant shadow-[var(--shadow-card)]"
      >
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
