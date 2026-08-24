'use client';

/** Create/edit dialog for a retailer-owned assortment: name, price, and a catalogue product picker with per-item quantities. */

import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Plus, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/app/components/ui/Button';
import { Field, FieldLabel } from '@/app/components/ui/Field';
import { Input } from '@/app/components/ui/Input';
import { NumberInput } from '@/app/components/ui/NumberInput';
import { toast } from '@/app/components/ui/toast';
import { cn } from '@/lib/utils';
import type { CatalogueProductSummary } from '@/lib/admin.types';
import { saveRetailerAssortmentAction } from './actions';
import type { RetailerAssortment } from '../_lib/assortments.server';

type SelectedItem = { quantity: number };

function centsToDollarsInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function AssortmentFormDialog({
  initial,
  products,
  trigger,
}: {
  initial?: RetailerAssortment;
  products: CatalogueProductSummary[];
  trigger?: ReactNode;
}) {
  const router = useRouter();
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [price, setPrice] = useState(initial ? centsToDollarsInput(initial.priceCents) : '0.00');
  const [isActive, setIsActive] = useState(initial?.isActive ?? false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Map<string, SelectedItem>>(
    () => new Map(initial?.items.map((item) => [item.catalogueItemId, { quantity: item.quantity }])),
  );
  const isEdit = Boolean(initial?.id);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setDescription(initial?.description ?? '');
    setPrice(initial ? centsToDollarsInput(initial.priceCents) : '0.00');
    setIsActive(initial?.isActive ?? false);
    setSelected(
      new Map(initial?.items.map((item) => [item.catalogueItemId, { quantity: item.quantity }])),
    );
    setQuery('');
  }, [open, initial]);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((product) =>
      [product.name, product.partNumber, product.manufacturer]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [products, query]);

  function toggleProduct(id: string) {
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(id)) next.delete(id);
      else next.set(id, { quantity: 1 });
      return next;
    });
  }

  function setQuantity(id: string, quantity: number) {
    setSelected((current) => {
      const next = new Map(current);
      const existing = next.get(id);
      if (existing) next.set(id, { quantity: Math.max(1, quantity) });
      return next;
    });
  }

  async function submit() {
    if (selected.size === 0) {
      toast.error('Pick at least one catalogue product.');
      return;
    }
    const priceCents = Math.round(Number(price) * 100);
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      toast.error('Enter a valid price.');
      return;
    }

    setIsPending(true);
    const result = await saveRetailerAssortmentAction({
      assortmentId: initial?.id ?? null,
      name,
      description: description || undefined,
      priceCents,
      isActive,
      items: [...selected.entries()].map(([catalogueItemId, { quantity }]) => ({
        catalogueItemId,
        quantity,
      })),
    });
    setIsPending(false);

    if (result.ok) {
      toast.success(isEdit ? 'Assortment updated' : 'Assortment created');
      setOpen(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus size={16} /> Create assortment
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit assortment' : 'New assortment'}</DialogTitle>
          <DialogDescription>
            Package catalogue products into a priced bundle. Only you can see or edit this
            assortment.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor={`${fieldId}-name`}>Name</FieldLabel>
              <Input
                id={`${fieldId}-name`}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Backyard Bash"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${fieldId}-price`}>Price ($)</FieldLabel>
              <Input
                id={`${fieldId}-price`}
                type="number"
                min={0}
                step={0.01}
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                required
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor={`${fieldId}-description`}>Description</FieldLabel>
            <Input
              id={`${fieldId}-description`}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional"
            />
          </Field>

          <Field>
            <FieldLabel>Products ({selected.size} selected)</FieldLabel>
            <Input
              iconLeft={<Search size={14} />}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search catalogue…"
            />
            <div className="border-border max-h-64 space-y-1.5 overflow-y-auto rounded-md border p-2">
              {filteredProducts.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center text-xs">No products found.</p>
              ) : (
                filteredProducts.map((product) => {
                  const entry = selected.get(product.id);
                  const isSelected = Boolean(entry);
                  return (
                    <div
                      key={product.id}
                      className={cn(
                        'flex items-center gap-3 rounded-md border p-2 transition-colors',
                        isSelected ? 'border-primary bg-primary/5' : 'border-transparent',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleProduct(product.id)}
                        aria-pressed={isSelected}
                        className={cn(
                          'flex size-5 shrink-0 items-center justify-center rounded border',
                          isSelected
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'border-input',
                        )}
                      >
                        {isSelected ? <Check size={12} strokeWidth={3} /> : null}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleProduct(product.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="truncate text-sm font-medium">{product.name}</div>
                        <div className="text-muted-foreground truncate font-mono text-xs">
                          {product.partNumber}
                        </div>
                      </button>
                      {isSelected ? (
                        <NumberInput
                          ariaLabel={`Quantity of ${product.name}`}
                          className="w-24"
                          min={1}
                          max={999}
                          value={entry!.quantity}
                          onChange={(value) => setQuantity(product.id, value)}
                        />
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </Field>

          <div className="flex items-center justify-between gap-3 pt-1">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
                className="accent-primary size-4"
              />
              Publish live immediately
            </label>
          </div>

          <DialogFooter>
            <Button type="submit" loading={isPending} disabled={isPending}>
              {isEdit ? 'Save changes' : 'Create assortment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
