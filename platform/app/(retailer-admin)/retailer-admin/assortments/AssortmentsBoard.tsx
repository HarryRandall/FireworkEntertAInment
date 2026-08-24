'use client';

/** Real, retailer-owned assortment list: live/draft toggle and delete call the guarded server actions; create/edit open AssortmentFormDialog. */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';
import { Badge, Button, Card, EmptyState } from '@/app/components/ui';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/app/components/ui/toast';
import type { CatalogueProductSummary } from '@/lib/admin.types';
import type { RetailerAssortment } from '../_lib/assortments.server';
import { deleteRetailerAssortmentAction, saveRetailerAssortmentAction } from './actions';
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

  function toggleStatus(assortment: RetailerAssortment) {
    setPendingId(assortment.id);
    startTransition(async () => {
      const result = await saveRetailerAssortmentAction({
        assortmentId: assortment.id,
        name: assortment.name,
        description: assortment.description ?? undefined,
        priceCents: assortment.priceCents,
        isActive: !assortment.isActive,
        items: assortment.items.map((item) => ({
          catalogueItemId: item.catalogueItemId,
          quantity: item.quantity,
        })),
      });
      setPendingId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

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
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge tone={assortment.isActive ? 'success' : 'neutral'} dot solid>
                      {assortment.isActive ? 'Live' : 'Draft'}
                    </Badge>
                    <span className="text-foreground truncate text-sm font-medium">
                      {assortment.name}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {assortment.items.length} product{assortment.items.length === 1 ? '' : 's'} ·{' '}
                    <span className="font-mono tabular-nums">
                      ${(assortment.priceCents / 100).toFixed(2)}
                    </span>
                  </p>
                </div>
                <label className="flex shrink-0 cursor-pointer items-center gap-2">
                  <span className="sr-only">Publish {assortment.name}</span>
                  <Switch
                    checked={assortment.isActive}
                    disabled={pendingId === assortment.id}
                    onCheckedChange={() => toggleStatus(assortment)}
                  />
                </label>
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
