'use client';

/**
 * ShoppingListTable is the sortable shopping list rendered on the show
 * detail route under the `/app` group. Pure client component: takes
 * the server-fetched items and lets the user sort + print locally.
 */
import { useState, useMemo } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Package, Printer } from 'lucide-react';
import { Card } from '@/components/design-system/Card';
import { Button } from '@/components/design-system/Button';
import { EmptyNotice } from '@/components/design-system/Feedback';
import { SectionHeader } from '@/components/design-system/SectionHeader';
import type { ShoppingListItem } from '@/lib/show-domain';

type SortKey = 'name' | 'qty' | 'total';
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
    <button
      type="button"
      onClick={() => onToggle(col)}
      aria-pressed={active}
      aria-label={
        active
          ? `Sort by ${label}, currently ${direction === 'desc' ? 'descending' : 'ascending'}`
          : `Sort by ${label}`
      }
      className={`flex min-h-11 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors ${
        active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
      <SortIcon aria-hidden="true" size={13} className={active ? 'opacity-100' : 'opacity-40'} />
    </button>
  );
}

export function ShoppingListTable({ items }: ShoppingListTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'qty') cmp = a.qty - b.qty;
      else if (sortKey === 'total') cmp = a.qty * a.priceCents - b.qty * b.priceCents;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [items, sortKey, sortDir]);

  const total = items.reduce((sum, item) => sum + (item.qty * item.priceCents) / 100, 0);
  const missingPriceCount = items.filter((item) => item.priceCents <= 0).length;
  const pricedItemCount = items.length - missingPriceCount;

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  return (
    <Card
      elevation="low"
      radius="md"
      className="space-y-6 p-4 sm:p-6 lg:p-8 print:border-none print:shadow-none"
    >
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
          <div
            className="flex flex-wrap items-center gap-1 print:hidden"
            role="group"
            aria-label="Sort shopping list"
          >
            <span className="text-muted-foreground text-xs">Sort by</span>
            <SortButton
              active={sortKey === 'name'}
              col="name"
              direction={sortKey === 'name' ? sortDir : null}
              label="Name"
              onToggle={toggleSort}
            />
            <SortButton
              active={sortKey === 'qty'}
              col="qty"
              direction={sortKey === 'qty' ? sortDir : null}
              label="Quantity"
              onToggle={toggleSort}
            />
            <SortButton
              active={sortKey === 'total'}
              col="total"
              direction={sortKey === 'total' ? sortDir : null}
              label="Total"
              onToggle={toggleSort}
            />
          </div>

          <ul className="space-y-3">
            {sorted.map((item) => {
              const lineTotal = (item.qty * item.priceCents) / 100;
              return (
                <li
                  key={item.id}
                  className="border-border/60 bg-muted/40 flex flex-col items-start justify-between gap-3 rounded-xl border p-4 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                    <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                      <Package size={18} strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-foreground text-sm font-medium break-words">
                        {item.name}
                      </div>
                      <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs tabular-nums">
                        <span>
                          Qty {item.qty} &times;{' '}
                          {item.priceCents > 0
                            ? `$${(item.priceCents / 100).toFixed(2)}`
                            : 'price TBC'}
                        </span>
                        <span className="font-mono break-all opacity-60">#{item.partNumber}</span>
                        {item.manufacturer && (
                          <span className="opacity-60">{item.manufacturer}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-primary self-end font-mono font-bold tabular-nums sm:self-auto">
                    {item.priceCents > 0 ? `$${lineTotal.toFixed(2)}` : '—'}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {items.length > 0 ? (
        <div className="border-border/60 flex flex-col gap-2 border-t pt-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-muted-foreground font-medium">
              {missingPriceCount > 0 ? 'Known-price subtotal' : 'Total estimated cost'}
            </p>
            {missingPriceCount > 0 ? (
              <p className="text-muted-foreground mt-1 text-xs">
                Excludes {missingPriceCount.toLocaleString()}{' '}
                {missingPriceCount === 1 ? 'product' : 'products'} with price TBC.
              </p>
            ) : null}
          </div>
          <span className="text-primary self-end font-mono text-2xl font-bold tabular-nums">
            {pricedItemCount > 0
              ? `$${total.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              : 'Price TBC'}
          </span>
        </div>
      ) : null}
    </Card>
  );
}
