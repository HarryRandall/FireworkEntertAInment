'use client';

/**
 * Real, retailer-owned assortment list. No live/draft state — an assortment
 * is reachable exactly when its physical QR code is (see
 * migration 20260824080000_retire_retailer_assortment_draft_state.sql) —
 * so this only offers create/edit/delete, all calling the guarded server
 * actions.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';
import { Button, Card, EmptyState } from '@/app/components/ui';
import { toast } from '@/app/components/ui/toast';
import type { CatalogueProductSummary } from '@/lib/admin.types';
import type { RetailerAssortment } from '../_lib/assortments.server';
import { deleteRetailerAssortmentAction } from './actions';
import { AssortmentFormDialog } from './AssortmentFormDialog';

export function AssortmentsBoard({
  assortments,
  products,
}: {
  assortments: RetailerAssortment[];
  products: CatalogueProductSummary[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function remove(assortment: RetailerAssortment) {
    if (!window.confirm(`Delete "${assortment.name}"? This can't be undone.`)) return;
    setPendingId(assortment.id);
    startTransition(async () => {
      const result = await deleteRetailerAssortmentAction({ assortmentId: assortment.id });
      setPendingId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Assortment deleted');
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <AssortmentFormDialog products={products} />
      </div>

      {assortments.length === 0 ? (
        <EmptyState title="No assortments yet">
          Package catalogue products into a priced bundle to get started.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {assortments.map((assortment) => (
            <Card key={assortment.id} className="flex flex-col gap-3 p-4">
              <div className="min-w-0">
                <span className="text-foreground truncate text-sm font-medium">
                  {assortment.name}
                </span>
                <p className="text-muted-foreground mt-1 text-xs">
                  {assortment.items.length} product{assortment.items.length === 1 ? '' : 's'} ·{' '}
                  <span className="font-mono tabular-nums">
                    ${(assortment.priceCents / 100).toFixed(2)}
                  </span>
                </p>
              </div>

              <ul className="text-muted-foreground space-y-0.5 text-xs">
                {assortment.items.slice(0, 3).map((item) => (
                  <li key={item.id} className="truncate">
                    {item.quantity}× {item.productName}
                  </li>
                ))}
                {assortment.items.length > 3 ? (
                  <li>+{assortment.items.length - 3} more</li>
                ) : null}
              </ul>

              <div className="mt-auto flex items-center gap-2 pt-1">
                <AssortmentFormDialog
                  initial={assortment}
                  products={products}
                  trigger={
                    <Button variant="secondary" size="sm">
                      <Pencil size={13} /> Edit
                    </Button>
                  }
                />
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={pendingId === assortment.id}
                  onClick={() => remove(assortment)}
                >
                  <Trash2 size={13} /> Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
