'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Button } from '@/ui/patterns/Button';
import { Card } from '@/ui/patterns/Card';
import { EmptyNotice } from '@/ui/patterns/Feedback';
import { NumberInput } from '@/ui/patterns/NumberInput';
import { SectionHeader } from '@/ui/patterns/SectionHeader';
import { toast } from '@/ui/patterns/toast';
import { formatBudget } from '@/lib/show-domain';
import type { AdminAssortmentDetail } from '@/lib/admin/assortments.server';
import { deleteAssortmentItem, upsertAssortmentItem } from '@/app/actions/admin-assortments';
import { AddCatalogueItemPicker } from './AddCatalogueItemPicker';

export function AssortmentProducts({ assortment }: { assortment: AdminAssortmentDetail }) {
  const quantity = assortment.items.reduce((total, item) => total + item.quantity, 0);
  return (
    <Card className="space-y-5 p-5 sm:p-6">
      <SectionHeader
        size="sm"
        title="Products in this pack"
        description={`${assortment.items.length} products · ${quantity} total items`}
      />
      <div className="divide-border divide-y">
        {assortment.items.map((item) => (
          <AssortmentItemRow key={item.id} assortmentId={assortment.id} item={item} />
        ))}
        {assortment.items.length === 0 ? (
          <EmptyNotice>Add your first product to start building this pack.</EmptyNotice>
        ) : null}
      </div>
      <AddCatalogueItemPicker
        assortmentId={assortment.id}
        existingCatalogueItemIds={assortment.items.map((item) => item.catalogueItemId)}
        nextSortOrder={Math.max(-1, ...assortment.items.map((item) => item.sortOrder)) + 1}
      />
      <p className="text-muted-foreground text-xs">
        Product changes save immediately. Pack details are saved separately.
      </p>
    </Card>
  );
}

function AssortmentItemRow({
  assortmentId,
  item,
}: {
  assortmentId: string;
  item: AdminAssortmentDetail['items'][number];
}) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(item.quantity);
  const [pending, startTransition] = useTransition();

  function updateQuantity(next: number) {
    setQuantity(next);
    startTransition(async () => {
      try {
        const result = await upsertAssortmentItem({
          assortmentId,
          catalogueItemId: item.catalogueItemId,
          quantity: next,
          sortOrder: item.sortOrder,
        });
        if (!result.ok) {
          setQuantity(item.quantity);
          toast.error(result.error);
        } else router.refresh();
      } catch {
        setQuantity(item.quantity);
        toast.error('The quantity could not be saved. Please try again.');
      }
    });
  }

  function remove() {
    startTransition(async () => {
      try {
        const result = await deleteAssortmentItem({ assortmentId, assortmentItemId: item.id });
        if (!result.ok) toast.error(result.error);
        else router.refresh();
      } catch {
        toast.error('The product could not be removed. Please try again.');
      }
    });
  }

  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-foreground truncate text-sm font-medium">{item.name}</p>
        <p className="text-muted-foreground truncate font-mono text-xs">
          {item.partNumber}
          {item.cheapestPriceCents != null ? ` · ${formatBudget(item.cheapestPriceCents)}` : ''}
        </p>
      </div>
      <NumberInput
        value={quantity}
        onChange={updateQuantity}
        disabled={pending}
        min={1}
        max={999}
        ariaLabel={`Quantity of ${item.name}`}
        className="w-28"
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={remove}
        aria-label={`Remove ${item.name}`}
      >
        <Trash2 size={14} aria-hidden="true" />
      </Button>
    </div>
  );
}
