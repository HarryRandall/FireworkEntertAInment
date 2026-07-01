/** DataTable primitives: class helpers + a Shell wrapper for consistent table styling across admin/app routes. */
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
        'border-border bg-background relative overflow-hidden rounded-lg border shadow-xs',
        viewport && 'min-h-0 md:flex md:flex-1 md:flex-col',
        className,
      )}
    >
      {caption ? (
        <div className="border-border/50 text-foreground shrink-0 border-b px-4 py-3 text-sm font-medium">
          {caption}
        </div>
      ) : null}
      <div className={cn('relative min-h-0', viewport && 'md:flex md:flex-1')}>
        <div
          className={cn(
            'isolate overflow-x-auto overscroll-x-contain',
            viewport &&
              'data-table-scrollport md:min-h-0 md:flex-1 md:overflow-x-auto md:overflow-y-auto md:overscroll-none',
          )}
        >
          {children}
        </div>
        {viewport ? (
          <div
            aria-hidden="true"
            className="border-border/50 bg-background pointer-events-auto absolute top-0 right-0 z-30 hidden h-11 w-4 border-b border-l md:block"
          />
        ) : null}
      </div>
      {footer ? <div className="border-border/50 shrink-0 border-t px-4 py-3">{footer}</div> : null}
    </div>
  );
}

/** Base classes for the `<table>` element. */
export function tableClasses(className?: string) {
  return cn(
    'w-full min-w-[760px] caption-bottom border-separate border-spacing-0 text-left text-sm',
    className,
  );
}

/** Classes for `<thead>`. */
export function tableHeadClasses(className?: string) {
  return cn(
    'bg-background [&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:border-b [&_th]:border-border/50 [&_th]:bg-background',
    className,
  );
}

/** Classes for `<th>` cells. */
export function tableHeaderCellClasses(className?: string) {
  return cn(
    'h-11 px-4 py-3 text-left align-middle text-sm font-medium whitespace-nowrap text-foreground',
    className,
  );
}

/** Classes for `<tr>` rows. */
export function tableRowClasses(className?: string) {
  return cn(
    'transition-colors last:[&>*]:border-b-0 [&>*]:border-b [&>*]:border-border/50',
    className,
  );
}

/** Classes for `<td>` cells. */
export function tableCellClasses(className?: string) {
  return cn('px-4 py-3 align-middle text-sm whitespace-nowrap text-foreground', className);
}
