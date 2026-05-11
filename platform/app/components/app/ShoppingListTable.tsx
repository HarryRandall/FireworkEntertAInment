"use client";

import { useState, useMemo } from "react";
import { Package, Printer, ArrowUpDown } from "lucide-react";
import { Card } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import type { ShoppingListItem } from "@/lib/show-domain";

type SortKey = "name" | "qty" | "total";
type SortDir = "asc" | "desc";

type ShoppingListTableProps = {
  items: ShoppingListItem[];
};

export function ShoppingListTable({ items }: ShoppingListTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "qty") cmp = a.qty - b.qty;
      else if (sortKey === "total") cmp = a.qty * a.priceCents - b.qty * b.priceCents;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [items, sortKey, sortDir]);

  const total = items.reduce((sum, item) => sum + (item.qty * item.priceCents) / 100, 0);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function SortButton({ col, label }: { col: SortKey; label: string }) {
    const active = sortKey === col;
    return (
      <button
        onClick={() => toggleSort(col)}
        className={`flex items-center gap-1 text-xs font-medium transition-colors ${
          active ? "text-primary" : "text-on-surface-variant hover:text-on-surface"
        }`}
      >
        {label}
        <ArrowUpDown
          size={12}
          className={active ? "opacity-100" : "opacity-40"}
        />
      </button>
    );
  }

  return (
    <Card elevation="low" radius="md" className="space-y-6 p-8 print:shadow-none print:border-none">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-on-surface">
            Shopping List
          </h2>
          <p className="text-sm text-on-surface-variant">
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
        <p className="rounded-xl border border-dashed border-outline-variant/20 bg-surface-container-highest/30 p-8 text-center text-sm text-on-surface-variant">
          No cues in this show yet. Add products to your timeline and they&apos;ll appear here.
        </p>
      ) : (
        <>
          {/* Sort controls */}
          <div className="flex items-center gap-4 print:hidden">
            <span className="text-xs text-on-surface-variant">Sort by</span>
            <SortButton col="name" label="Name" />
            <SortButton col="qty" label="Qty" />
            <SortButton col="total" label="Total" />
          </div>

          <ul className="space-y-3">
            {sorted.map((item) => {
              const lineTotal = (item.qty * item.priceCents) / 100;
              return (
                <li
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-outline-variant/10 bg-surface-container-highest/40 p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Package size={18} strokeWidth={1.75} />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-on-surface">
                        {item.name}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs tabular-nums text-on-surface-variant">
                        <span>Qty {item.qty} &times; {item.priceCents > 0 ? `$${(item.priceCents / 100).toFixed(2)}` : "price TBC"}</span>
                        <span className="font-mono opacity-60">#{item.partNumber}</span>
                        {item.manufacturer && (
                          <span className="opacity-60">{item.manufacturer}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="font-bold tabular-nums text-primary">
                    {item.priceCents > 0 ? `$${lineTotal.toFixed(2)}` : "—"}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <div className="flex items-center justify-between border-t border-outline-variant/10 pt-6">
        <span className="font-medium text-on-surface-variant">
          Total estimated cost
        </span>
        <span className="text-2xl font-bold tabular-nums text-primary">
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
