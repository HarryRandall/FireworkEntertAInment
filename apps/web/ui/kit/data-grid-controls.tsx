/** ReUI column visibility and pagination adapted to the shared Radix controls. */
'use client';
// The TanStack table instance is mutable, so compiler memoisation would render stale state.
'use no memo';
import type { Table } from '@tanstack/react-table';
import { DropdownMenu } from 'radix-ui';
import { Check } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { Select } from '@/ui/primitives/input';

// ReUI's smallest page sizes keep the gallery usable on a phone; units are rows.
const COMPACT_PAGE_ROWS = 5;
const STANDARD_PAGE_ROWS = 10;
const MEDIUM_PAGE_ROWS = 25;
const LARGE_PAGE_ROWS = 50;
export const GRID_PAGE_SIZES = [
  COMPACT_PAGE_ROWS,
  STANDARD_PAGE_ROWS,
  MEDIUM_PAGE_ROWS,
  LARGE_PAGE_ROWS,
];

/** Toggles optional columns without closing the keyboard-navigable menu. */
export function DataGridColumnVisibility<T>({ table }: { table: Table<T> }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="outline">Columns</Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="bg-popover text-popover-foreground border-border shadow-card z-50 min-w-40 rounded-lg border p-1"
        >
          {table
            .getAllLeafColumns()
            .filter((column) => column.getCanHide())
            .map((column) => (
              <DropdownMenu.CheckboxItem
                key={column.id}
                checked={column.getIsVisible()}
                onCheckedChange={(value) => {
                  column.toggleVisibility(value);
                }}
                onSelect={(event) => {
                  event.preventDefault();
                }}
                className="data-[highlighted]:bg-accent relative rounded px-7 py-2 text-sm outline-none"
              >
                <DropdownMenu.ItemIndicator className="absolute left-2">
                  <Check className="size-3" />
                </DropdownMenu.ItemIndicator>
                {typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id}
              </DropdownMenu.CheckboxItem>
            ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** Reports visible row bounds and changes pages while preserving selection by row id. */
export function DataGridPagination<T>({ table }: { table: Table<T> }) {
  const { pageIndex, pageSize } = table.getState().pagination;
  const count = table.getFilteredRowModel().rows.length;
  const from = count === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min((pageIndex + 1) * pageSize, count);
  return (
    <div
      data-slot="data-grid-pagination"
      className="flex flex-wrap items-center justify-between gap-3 text-sm"
    >
      <label className="flex items-center gap-2">
        Rows per page
        <Select
          className="w-20"
          value={pageSize}
          onChange={(event) => {
            table.setPageSize(Number(event.target.value));
          }}
        >
          {GRID_PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </Select>
      </label>
      <span role="status">
        {from} to {to} of {count} · {table.getFilteredSelectedRowModel().rows.length} selected
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled={!table.getCanPreviousPage()}
          onClick={() => {
            table.previousPage();
          }}
        >
          Previous page
        </Button>
        <Button
          variant="outline"
          disabled={!table.getCanNextPage()}
          onClick={() => {
            table.nextPage();
          }}
        >
          Next page
        </Button>
      </div>
    </div>
  );
}
