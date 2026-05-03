import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { uiStyles } from "@/app/components/ui/styles";

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
        uiStyles.table.shell,
        className,
      )}
    >
      {caption ? (
        <div className={uiStyles.table.caption}>
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
    uiStyles.table.head,
    className,
  );
}

export function tableHeaderCellClasses(className?: string) {
  return cn(
    uiStyles.table.headerCell,
    className,
  );
}

export function tableRowClasses(className?: string) {
  return cn(
    uiStyles.table.row,
    className,
  );
}

export function tableCellClasses(className?: string) {
  return cn(uiStyles.table.cell, className);
}
