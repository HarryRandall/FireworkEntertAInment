import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type InfoTooltipProps = {
  text: ReactNode;
  className?: string;
};

export function InfoTooltip({ text, className }: InfoTooltipProps) {
  return (
    <span className={cn("relative inline-flex", className)}>
      <button
        type="button"
        aria-label="More information"
        className="peer inline-flex h-5 w-5 items-center justify-center rounded-full border border-outline-variant/70 bg-surface text-on-surface-variant transition-colors hover:border-outline hover:text-on-surface focus:outline-none focus-visible:border-outline focus-visible:text-on-surface"
      >
        <span className="block text-[12px] leading-none font-serif italic">i</span>
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-20 w-56 -translate-x-1/2 rounded-md border border-outline-variant/70 bg-surface px-3 py-2 text-xs font-medium normal-case tracking-normal text-on-surface-variant opacity-0 transition-opacity duration-150 peer-hover:opacity-100 peer-focus-visible:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}
