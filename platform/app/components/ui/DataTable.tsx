import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function DataTableShell({
  caption,
  children,
  className,
}: {
  caption?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-outline-variant/55 bg-surface-container-low/88 shadow-[var(--shadow-card)]",
        className,
      )}
    >
      {caption ? (
        <div className="border-b border-outline-variant/45 px-4 py-3 text-sm font-semibold text-on-surface-variant">
          {caption}
        </div>
      ) : null}
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

export function tableClasses(className?: string) {
  return cn("w-full min-w-[760px] text-left text-sm", className);
}

export function tableHeadClasses(className?: string) {
  return cn(
    "sticky top-0 z-10 bg-surface-container-high text-on-surface-variant",
    className,
  );
}

export function tableHeaderCellClasses(className?: string) {
  return cn(
    "px-4 py-3 text-xs font-bold uppercase tracking-[0.14em]",
    className,
  );
}

export function tableRowClasses(className?: string) {
  return cn(
    "border-t border-outline-variant/30 transition-colors hover:bg-surface-container-high/45 focus-within:bg-surface-container-high/60",
    className,
  );
}

export function tableCellClasses(className?: string) {
  return cn("px-4 py-3 align-middle", className);
}
