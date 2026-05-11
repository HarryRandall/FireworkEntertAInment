import { Package } from "lucide-react";
import { Card } from "@/app/components/ui/Card";
import type { ShoppingListItem } from "@/lib/show-domain";

type ShoppingListTableProps = {
  items: ShoppingListItem[];
};

export function ShoppingListTable({ items }: ShoppingListTableProps) {
  const total = items.reduce(
    (sum, item) => sum + (item.qty * item.priceCents) / 100,
    0,
  );

  return (
    <Card elevation="low" radius="md" className="space-y-6 p-8">
      <header className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-on-surface">
          Shopping List
        </h2>
        <p className="text-sm text-on-surface-variant">
          Everything you need to purchase for this show, sourced from your
          local retailer&apos;s catalogue.
        </p>
      </header>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-outline-variant/20 bg-surface-container-highest/30 p-8 text-center text-sm text-on-surface-variant">
          No items yet. The AI will populate this list once your show is
          generated.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const lineTotal = (item.qty * item.priceCents) / 100;
            return (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-outline-variant/10 bg-surface-container-highest/40 p-4"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Package size={18} strokeWidth={1.75} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-on-surface">
                      {item.name}
                    </div>
                    <div className="text-xs tabular-nums text-on-surface-variant">
                      Qty {item.qty} &times; ${(item.priceCents / 100).toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="font-bold tabular-nums text-primary">
                  ${lineTotal.toFixed(2)}
                </div>
              </li>
            );
          })}
        </ul>
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
