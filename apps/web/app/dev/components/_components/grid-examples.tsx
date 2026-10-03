/** Grid review states use stable synthetic record ids and consumer-owned row actions. */
'use client';
import { useState } from 'react';
import { Checkbox } from 'radix-ui';
import { Check } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataGrid } from '@/ui/kit/data-grid';
import { ActionMenu } from '@/ui/kit/overlays';
import { Button } from '@/ui/primitives/button';
import { Group, Example } from './example';
import { type ScanRecord } from './dashboard-fixtures';

function GridSelection({
  checked,
  label,
  onChange,
}: {
  checked: boolean | 'indeterminate';
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Checkbox.Root
      aria-label={label}
      checked={checked}
      onCheckedChange={(value) => {
        onChange(value === true);
      }}
      className="border-border-strong data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground grid size-5 place-items-center rounded border"
    >
      <Checkbox.Indicator>
        <Check className="size-3" />
      </Checkbox.Indicator>
    </Checkbox.Root>
  );
}
function pageSelection(all: boolean, some: boolean): boolean | 'indeterminate' {
  if (all) return true;
  return some ? 'indeterminate' : false;
}
function gridColumns(onInspect: (row: ScanRecord) => void): ColumnDef<ScanRecord>[] {
  return [
    {
      id: 'selection',
      enableHiding: false,
      enableSorting: false,
      header: ({ table }) => (
        <GridSelection
          label="Select page rows"
          checked={pageSelection(
            table.getIsAllPageRowsSelected(),
            table.getIsSomePageRowsSelected(),
          )}
          onChange={(value) => {
            table.toggleAllPageRowsSelected(value);
          }}
        />
      ),
      cell: ({ row }) => (
        <GridSelection
          label={`Select ${row.original.id}`}
          checked={row.getIsSelected()}
          onChange={(value) => {
            row.toggleSelected(value);
          }}
        />
      ),
    },
    // Text starts alphabetically; counts start highest first without relying on inferred types.
    { accessorKey: 'day', header: 'Day', sortDescFirst: false },
    { accessorKey: 'placement', header: 'Placement', sortDescFirst: false },
    { accessorKey: 'store', header: 'Store', sortDescFirst: false },
    { accessorKey: 'scans', header: 'Scans', sortDescFirst: true },
    { accessorKey: 'plays', header: 'Plays', sortDescFirst: true },
    {
      id: 'actions',
      enableHiding: false,
      enableSorting: false,
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <ActionMenu
          trigger={
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.original.id}`}>
              ⋯
            </Button>
          }
          actions={[
            {
              label: 'Inspect record',
              onSelect: () => {
                onInspect(row.original);
              },
            },
          ]}
        />
      ),
    },
  ];
}
/** Demonstrates sorting, visibility, stable selection, row actions and pagination. */
function GridExamples({ records }: { records: ScanRecord[] }) {
  const [message, setMessage] = useState('');
  const columns = gridColumns((row) => {
    setMessage(`${row.store}: ${String(row.scans)} scans on ${row.day}`);
  });
  return (
    <>
      <DataGrid
        data={records}
        columns={columns}
        label="Synthetic scan records"
        numericColumns={['scans', 'plays']}
      />
      <p role="status" className="text-muted-foreground text-sm">
        {message}
      </p>
    </>
  );
}

/** Demonstrates distinct pending and failed reads with a consumer-owned retry action. */
function GridFeedbackExample({ records }: { records: ScanRecord[] }) {
  const [kind, setKind] = useState<'loading' | 'error' | 'ready'>('loading');
  const state =
    kind === 'error'
      ? {
          kind,
          message: 'The synthetic preview could not load.',
          onRetry: () => {
            setKind('ready');
          },
        }
      : { kind };
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => {
            setKind('loading');
          }}
        >
          Show pending grid
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setKind('error');
          }}
        >
          Show failed grid
        </Button>
      </div>
      <DataGrid
        data={records}
        columns={gridColumns(() => {
          setKind('ready');
        })}
        label="Grid feedback preview"
        state={state}
        numericColumns={['scans', 'plays']}
      />
    </div>
  );
}

/** Groups record interactions and asynchronous feedback for owner review. */
export function GridGallery({ records }: { records: ScanRecord[] }) {
  return (
    <Group id="data-grid" title="Data grid">
      <Example
        id="scan-grid"
        title="Scan records"
        source="ReUI Data Grid / TanStack Table"
        description="Sortable headers, optional columns, page selection, right-aligned counts and trailing row actions."
      >
        <GridExamples records={records} />
      </Example>
      <Example
        id="grid-feedback"
        title="Pending and failed reads"
        source="ReUI adaptation"
        description="Loading, read failures and a successful retry stay distinct from an empty result."
      >
        <GridFeedbackExample records={records} />
      </Example>
    </Group>
  );
}
