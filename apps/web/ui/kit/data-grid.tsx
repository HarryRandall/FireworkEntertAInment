/** ReUI table composition adapted to a small, typed consumer API. */
'use client';
'use no memo';
import { useState } from 'react';
import {
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type RowSelectionState,
} from '@tanstack/react-table';
import { Button } from '@/ui/primitives/button';
import { DataGridTable } from './data-grid-table';
import {
  DataGridColumnVisibility,
  DataGridPagination,
  GRID_PAGE_SIZES,
} from './data-grid-controls';

/** Distinguishes pending data from an unexpected read failure; retries stay consumer-owned. */
export type DataGridState =
  | { kind: 'ready' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string; onRetry: () => void };

/** Displays locally paginated records with stable ids, sorting, visibility and persistent selection. */
export function DataGrid<T extends { id: string }>({
  data,
  columns,
  label,
  numericColumns,
  state = { kind: 'ready' },
}: {
  data: T[];
  columns: ColumnDef<T>[];
  label: string;
  numericColumns?: readonly string[];
  state?: DataGridState;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: GRID_PAGE_SIZES[0],
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack v8 exposes mutable methods; this component opts out of compiler memoisation.
  const table = useReactTable({
    data,
    columns,
    getRowId: (row) => row.id,
    state: { sorting, columnVisibility, rowSelection, pagination },
    // A parent re-render must not move the reader; only a new sort returns to the first page.
    autoResetPageIndex: false,
    onSortingChange: (update) => {
      setSorting(update);
      setPagination((current) => ({ ...current, pageIndex: 0 }));
    },
    onPaginationChange: setPagination,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });
  // Fewer records (for example after filtering) can leave the page past the end.
  const lastPageIndex = Math.max(0, table.getPageCount() - 1);
  if (pagination.pageIndex > lastPageIndex) {
    setPagination({ ...pagination, pageIndex: lastPageIndex });
  }
  if (state.kind === 'loading')
    return (
      <div role="status" aria-busy="true" className="bg-muted rounded-lg p-6 text-sm">
        Loading {label.toLowerCase()}...
      </div>
    );
  if (state.kind === 'error')
    return (
      <div className="border-destructive grid gap-3 rounded-lg border p-4">
        <p role="alert">{state.message}</p>
        <Button variant="outline" onClick={state.onRetry}>
          Retry {label.toLowerCase()}
        </Button>
      </div>
    );
  return (
    <div className="grid min-w-0 grid-cols-1 gap-4">
      <div className="flex justify-end">
        <DataGridColumnVisibility table={table} />
      </div>
      <DataGridTable table={table} label={label} numericColumns={numericColumns} />
      <DataGridPagination table={table} />
    </div>
  );
}
