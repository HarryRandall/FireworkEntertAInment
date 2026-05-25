'use client';

/**
 * ShoppingListTable — sortable shopping list rendered on the show
 * detail route under the `/app` group. Pure client component: takes
 * the server-fetched items and lets the user sort + print locally.
 */
import { useState, useMemo } from 'react';
import { Package, Printer, ArrowUpDown } from 'lucide-react';
import { Card } from '@/app/components/ui/Card';
import { Button } from '@/app/components/ui/Button';
import type { ShoppingListItem } from '@/lib/show-domain';

type SortKey = 'name' | 'qty' | 'total';
type SortDir = 'asc' | 'desc';

type ShoppingListTableProps = {
  items: ShoppingListItem[];
};

type SortButtonProps = {
  active: boolean;
  col: SortKey;
  label: string;
  onToggle: (key: SortKey) => void;
};

function SortButton({ active, col, label, onToggle }: SortButtonProps) {
  return (
    <button
      onClick={() => onToggle(col)}
      className={`flex items-center gap-1 text-xs font-medium transition-colors ${
        active ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
      }`}
    >
      {label}
      <ArrowUpDown size={12} className={active ? 'opacity-100' : 'opacity-40'} />
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

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  return (
    <Card elevation="low" radius="md" className="space-y-6 p-8 print:border-none print:shadow-none">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-on-surface text-2xl font-bold tracking-tight">Shopping List</h2>
          <p className="text-on-surface-variant text-sm">
            Products needed for this show, derived from your show cues.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => window.print()}
          className="shrink-0 print:hidden"
        >
          <Printer size={15} />
          Print
        </Button>
      </header>

      {items.length === 0 ? (
        <p className="border-outline-variant/20 bg-surface-container-highest/30 text-on-surface-variant rounded-xl border border-dashed p-8 text-center text-sm">
          No cues in this show yet. Add products to your timeline and they&apos;ll appear here.
        </p>
      ) : (
        <>
          {/* Sort controls */}
          <div className="flex items-center gap-4 print:hidden">
            <span className="text-on-surface-variant text-xs">Sort by</span>
            <SortButton active={sortKey === 'name'} col="name" label="Name" onToggle={toggleSort} />
            <SortButton active={sortKey === 'qty'} col="qty" label="Qty" onToggle={toggleSort} />
            <SortButton
              active={sortKey === 'total'}
              col="total"
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
                  className="border-outline-variant/10 bg-surface-container-highest/40 flex items-center justify-between rounded-xl border p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                      <Package size={18} strokeWidth={1.75} />
                    </div>
                    <div>
                      <div className="text-on-surface text-sm font-medium">{item.name}</div>
                      <div className="text-on-surface-variant mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs tabular-nums">
                        <span>
                          Qty {item.qty} &times;{' '}
                          {item.priceCents > 0
                            ? `$${(item.priceCents / 100).toFixed(2)}`
                            : 'price TBC'}
                        </span>
                        <span className="font-mono opacity-60">#{item.partNumber}</span>
                        {item.manufacturer && (
                          <span className="opacity-60">{item.manufacturer}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-primary font-bold tabular-nums">
                    {item.priceCents > 0 ? `$${lineTotal.toFixed(2)}` : '—'}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <div className="border-outline-variant/10 flex items-center justify-between border-t pt-6">
        <span className="text-on-surface-variant font-medium">Total estimated cost</span>
        <span className="text-primary text-2xl font-bold tabular-nums">
          $
          {total.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      </div>
    </Card>
  );
}
