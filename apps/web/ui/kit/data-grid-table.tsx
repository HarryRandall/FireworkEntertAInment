/** ReUI's non-virtual table rendering with native table semantics and token styling. */
'use client';
// The TanStack table instance is mutable, so compiler memoisation would render stale state.
'use no memo';
import { flexRender, type Table, type Header } from '@tanstack/react-table';
import { Button } from '@/ui/primitives/button';
import { cn } from '@/lib/utils';

function sortAnnouncement(sort: false | 'asc' | 'desc') {
  if (sort === false) return undefined;
  return sort === 'asc' ? 'ascending' : 'descending';
}
function sortSymbol(sort: false | 'asc' | 'desc') {
  if (sort === false) return ' ↕';
  return sort === 'asc' ? ' ↑' : ' ↓';
}
/** Adds sortable header buttons and announces ascending or descending order. */
function GridHeader<T>({ header, numeric }: { header: Header<T, unknown>; numeric: boolean }) {
  const sort = header.column.getIsSorted();
  const content = header.isPlaceholder
    ? null
    : flexRender(header.column.columnDef.header, header.getContext());
  return (
    <th
      scope="col"
      aria-sort={sortAnnouncement(sort)}
      className={cn(
        'border-border bg-muted border-b px-3 py-2 text-left font-medium',
        numeric && 'text-right',
      )}
    >
      {header.column.getCanSort() ? (
        <Button
          variant="ghost"
          className={cn('h-auto px-0', numeric && 'ml-auto')}
          onClick={header.column.getToggleSortingHandler()}
        >
          {content}
          <span aria-hidden="true">{sortSymbol(sort)}</span>
        </Button>
      ) : (
        content
      )}
    </th>
  );
}

/** Renders visible cells; numeric column ids determine right alignment, with actions pinned last. */
export function DataGridTable<T>({
  table,
  label,
  numericColumns = [],
}: {
  table: Table<T>;
  label: string;
  numericColumns?: readonly string[];
}) {
  return (
    // Positioned so absolutely placed controls inside cells (Radix's hidden checkbox input)
    // are clipped by this scroller instead of widening the page.
    <div
      role="region"
      aria-label={`${label} table`}
      tabIndex={0}
      className="border-border relative max-w-full min-w-0 overflow-x-auto rounded-lg border"
    >
      <table data-slot="data-grid-table" className="w-full text-sm">
        <caption className="sr-only">{label}</caption>
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <GridHeader
                  key={header.id}
                  header={header}
                  numeric={numericColumns.includes(header.column.id)}
                />
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              data-state={row.getIsSelected() ? 'selected' : undefined}
              className="hover:bg-muted data-[state=selected]:bg-highlight-soft"
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className={cn(
                    'border-border border-b px-3 py-2.5',
                    numericColumns.includes(cell.column.id) && 'text-right tabular-nums',
                    cell.column.id === 'actions' && 'bg-card sticky right-0 w-12 text-right',
                  )}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
          {table.getRowModel().rows.length === 0 && (
            <tr>
              <td
                colSpan={table.getVisibleLeafColumns().length}
                className="text-muted-foreground p-6 text-center"
              >
                No matching records.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
