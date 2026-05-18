import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

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
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-[color:var(--color-border-default)] bg-[color:var(--color-bg-default)]",
        className,
      )}
    >
      {caption ? (
        <div className="border-b border-[color:var(--color-border-subtle)] px-4 py-3 text-sm font-medium text-[color:var(--color-content-default)]">
          {caption}
        </div>
      ) : null}
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function tableClasses(className?: string) {
  return cn("w-full min-w-[760px] text-left text-sm", className);
}

export function tableHeadClasses(className?: string) {
  return cn(
    "sticky top-0 z-10 bg-[color:var(--color-bg-muted)] text-[color:var(--color-content-subtle)]",
    className,
  );
}

export function tableHeaderCellClasses(className?: string) {
  return cn(
    "px-4 py-2.5 text-xs font-medium uppercase tracking-wide",
    className,
  );
}

export function tableRowClasses(className?: string) {
  return cn(
    "border-t border-[color:var(--color-border-subtle)] transition-colors hover:bg-[color:var(--color-bg-muted)]",
    className,
  );
}

export function tableCellClasses(className?: string) {
  return cn(
    "px-4 py-3 align-middle text-sm text-[color:var(--color-content-default)]",
    className,
  );
}
