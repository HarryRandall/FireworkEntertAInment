/** Searchable catalogue lists reuse the shared ReUI grid and its sorting and pagination. */
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import type { CatalogueRow } from '@/lib/catalogue/types';
import { Input } from '@/ui/primitives/input';
import { DataGrid } from '@/ui/kit/data-grid';
import { Badge } from '@/ui/kit/feedback';
import { CataloguePoster } from './catalogue-poster';

const columns: ColumnDef<CatalogueRow>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        {row.original.preview && (
          <div className="w-20 shrink-0">
            <CataloguePoster preview={row.original.preview} />
          </div>
        )}
        <div className="grid gap-1">
          {row.original.href !== '' ? (
            <Link
              className="font-medium underline-offset-4 hover:underline"
              href={row.original.href}
            >
              {row.original.name}
            </Link>
          ) : (
            <b>{row.original.name}</b>
          )}
          <span className="text-muted-foreground text-xs">{row.original.description}</span>
        </div>
      </div>
    ),
  },
  { accessorKey: 'kind', header: 'Kind / market' },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <Badge>{row.original.status.replaceAll('_', ' ')}</Badge>,
  },
  {
    accessorKey: 'updated',
    header: 'Edited',
    cell: ({ row }) =>
      new Date(row.original.updated).toLocaleDateString('en-GB', { timeZone: 'UTC' }),
  },
];
/** Filters parent metadata while retaining the grid's stable row identities. */
export function CatalogueGrid({ rows, label }: { rows: CatalogueRow[]; label: string }) {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [kind, setKind] = useState('');
  const filtered = rows.filter(
    (row) =>
      (status === '' || row.status === status) &&
      (kind === '' || row.kind === kind) &&
      `${row.name} ${row.description} ${row.kind}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="grid min-w-0 gap-4" data-catalogue-grid data-hydrated={hydrated}>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid flex-1 gap-1 text-sm">
          Search {label.toLowerCase()}
          <Input
            className="min-w-0"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Status
          <select
            aria-label="Status"
            className="border-input bg-background rounded-md border p-2"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
            }}
          >
            <option value="">All statuses</option>
            {Array.from(new Set(rows.map((row) => row.status)))
              .sort()
              .map((value) => (
                <option key={value}>{value}</option>
              ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Kind / market
          <select
            aria-label="Kind / market"
            className="border-input bg-background rounded-md border p-2"
            value={kind}
            onChange={(event) => {
              setKind(event.target.value);
            }}
          >
            <option value="">All kinds / markets</option>
            {Array.from(new Set(rows.map((row) => row.kind)))
              .sort()
              .map((value) => (
                <option key={value}>{value}</option>
              ))}
          </select>
        </label>
      </div>
      <p className="text-muted-foreground text-sm" role="status">
        {filtered.length} of {rows.length} records
      </p>
      <DataGrid data={filtered} columns={columns} label={label} />
    </div>
  );
}
