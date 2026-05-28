/** DataTable primitives — class helpers + a Shell wrapper for consistent table styling across admin/app routes. */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Bordered, rounded container for tables. Wrap any `<table>` in this for consistent chrome. */
export function DataTableShell({
  caption,
  children,
  className,
  footer,
  viewport = false,
}: {
  caption?: ReactNode;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
  viewport?: boolean;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-[color:var(--color-border-default)] bg-[color:var(--color-bg-default)]',
        viewport && 'min-h-0 md:flex md:flex-1 md:flex-col',
        className,
      )}
    >
      {caption ? (
        <div className="shrink-0 border-b border-[color:var(--color-border-subtle)] px-4 py-3 text-sm font-medium text-[color:var(--color-content-default)]">
          {caption}
        </div>
      ) : null}
      <div className={cn('overflow-x-auto', viewport && 'md:min-h-0 md:flex-1 md:overflow-auto')}>
        {children}
      </div>
      {footer ? (
        <div className="shrink-0 border-t border-[color:var(--color-border-subtle)] px-4 py-4 sm:px-5">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

/** Base classes for the `<table>` element. */
export function tableClasses(className?: string) {
  return cn('w-full min-w-[760px] text-left text-sm', className);
}

/** Classes for `<thead>`. */
export function tableHeadClasses(className?: string) {
  return cn(
    'sticky top-0 z-10 bg-[color:var(--color-bg-muted)] text-[color:var(--color-content-subtle)]',
    className,
  );
}

/** Classes for `<th>` cells. */
export function tableHeaderCellClasses(className?: string) {
  return cn('px-4 py-2.5 text-xs font-medium uppercase tracking-wide', className);
}

/** Classes for `<tr>` rows. */
export function tableRowClasses(className?: string) {
  return cn(
    'border-t border-[color:var(--color-border-subtle)] transition-colors hover:bg-[color:var(--color-bg-muted)]',
    className,
  );
}

/** Classes for `<td>` cells. */
export function tableCellClasses(className?: string) {
  return cn('px-4 py-3 align-middle text-sm text-[color:var(--color-content-default)]', className);
}
