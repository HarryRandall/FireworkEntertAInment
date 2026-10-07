'use client';

/**
 * ShoppingListTable is the sortable shopping list rendered on the show
 * detail route under the `/app` group. Pure client component: takes
 * the server-fetched items and lets the user sort + print locally.
 */
import { useState, useMemo } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Printer } from 'lucide-react';
import {
  DataTableShell,
  tableClasses,
  tableHeadClasses,
  tableHeaderCellClasses,
  tableRowClasses,
  tableCellClasses,
} from '@/ui/patterns/DataTable';
import { TablePagination } from '@/ui/patterns/TablePagination';
import { SelectField } from '@/ui/patterns/SelectField';
import { formatShowCurrency } from './show-display';
import { Card } from '@/ui/patterns/Card';
import { Button } from '@/ui/patterns/Button';
import { EmptyNotice } from '@/ui/patterns/Feedback';
import { SectionHeader } from '@/ui/patterns/SectionHeader';
import type { ShoppingListItem } from '@/lib/show-domain';

type SortKey = 'name' | 'qty' | 'price' | 'total';
type SortDir = 'asc' | 'desc';

type ShoppingListTableProps = {
  items: ShoppingListItem[];
};

type SortButtonProps = {
  active: boolean;
  col: SortKey;
  direction: SortDir | null;
  label: string;
  onToggle: (key: SortKey) => void;
};

function SortButton({ active, col, direction, label, onToggle }: SortButtonProps) {
  const SortIcon = active ? (direction === 'desc' ? ArrowDown : ArrowUp) : ArrowUpDown;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => onToggle(col)}
      aria-pressed={active}
      aria-label={
        active
          ? `Sort by ${label}, currently ${direction === 'desc' ? 'descending' : 'ascending'}`
          : `Sort by ${label}`
      }
      className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors ${
        active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
      <SortIcon aria-hidden="true" size={13} />
    </Button>
  );
}

/** Sort and print a compact product table with honest unknown-price totals. */
export function ShoppingListTable({ items }: ShoppingListTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'qty') cmp = a.qty - b.qty;
      else if (sortKey === 'price') cmp = a.priceCents - b.priceCents;
      else if (sortKey === 'total') cmp = a.qty * a.priceCents - b.qty * b.priceCents;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [items, sortKey, sortDir]);

  const total = items.reduce(
    (sum, item) => sum + (item.priceCents > 0 ? item.qty * item.priceCents : 0),
    0,
  );
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleItems = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);
  const missingPriceCount = items.filter((item) => item.priceCents <= 0).length;
  const pricedItemCount = items.length - missingPriceCount;

  function toggleSort(key: SortKey) {
    setPage(1);
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  return (
    <Card radius="md" className="min-w-0 space-y-4 p-4 print:border-none print:shadow-none">
      <SectionHeader
        title="Shopping List"
        description="Products needed for this show, derived from your show cues."
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.print()}
            className="print:hidden"
          >
            <Printer size={15} />
            Print
          </Button>
        }
      />

      {items.length === 0 ? (
        <EmptyNotice>
          No cues in this show yet. Add products to your timeline and they&apos;ll appear here.
        </EmptyNotice>
      ) : (
        <>
          <DataTableShell>
            <table className={tableClasses('min-w-[560px]')}>
              <thead className={tableHeadClasses()}>
                <tr aria-label="Sort shopping list">
                  {(
                    [
                      ['name', 'Name'],
                      ['qty', 'Quantity'],
                      ['price', 'Unit price'],
                      ['total', 'Line total'],
                    ] as const
                  ).map(([key, label]) => (
                    <th
                      key={key}
                      scope="col"
                      aria-sort={
                        sortKey === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
                      }
                      className={tableHeaderCellClasses(key === 'name' ? '' : '[&_button]:ml-auto')}
                    >
                      <SortButton
                        active={sortKey === key}
                        col={key}
                        direction={sortKey === key ? sortDir : null}
                        label={label}
                        onToggle={toggleSort}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((item) => (
                  <tr
                    key={item.id}
                    className={tableRowClasses(
                      `${visibleItems.includes(item) ? '' : 'hidden print:table-row'}`,
                    )}
                  >
                    <td className={tableCellClasses('max-w-sm whitespace-normal')}>
                      <div className="font-medium break-words">{item.name}</div>
                      <div className="text-muted-foreground mt-0.5 text-xs [overflow-wrap:anywhere]">
                        {[item.manufacturer, item.partNumber ? `#${item.partNumber}` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </td>
                    <td className={tableCellClasses('text-right tabular-nums')}>
                      {item.qty.toLocaleString('en-AU')}
                    </td>
                    <td className={tableCellClasses('text-right tabular-nums')}>
                      {item.priceCents > 0 ? formatShowCurrency(item.priceCents) : 'Price TBC'}
                    </td>
                    <td className={tableCellClasses('text-right font-medium tabular-nums')}>
                      {item.priceCents > 0
                        ? formatShowCurrency(item.qty * item.priceCents)
                        : 'Price TBC'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th
                    scope="row"
                    colSpan={3}
                    className={tableCellClasses('border-border border-t whitespace-normal')}
                  >
                    {missingPriceCount > 0 ? 'Known-price subtotal' : 'Total estimated cost'}
                    {missingPriceCount > 0 ? (
                      <p className="text-muted-foreground mt-1 text-xs font-normal">
                        Excludes {missingPriceCount.toLocaleString()}{' '}
                        {missingPriceCount === 1 ? 'product' : 'products'} with price TBC.
                      </p>
                    ) : null}
                  </th>
                  <td
                    className={tableCellClasses(
                      'border-border border-t text-right font-semibold tabular-nums',
                    )}
                  >
                    {pricedItemCount > 0 ? formatShowCurrency(total) : 'Price TBC'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </DataTableShell>
          <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <SelectField
              ariaLabel="Products per page"
              value={String(pageSize)}
              onChange={(value) => {
                setPageSize(Number(value));
                setPage(1);
              }}
              options={[
                { value: '25', label: '25 per page' },
                { value: '50', label: '50 per page' },
              ]}
              className="h-9 w-36"
            />
            <TablePagination
              currentPage={safePage}
              totalPages={totalPages}
              searchParams={{}}
              onPageChange={setPage}
              pageSize={pageSize}
              totalItems={items.length}
              visibleItems={visibleItems.length}
              itemLabel="product"
            />
          </div>
        </>
      )}
    </Card>
  );
}
