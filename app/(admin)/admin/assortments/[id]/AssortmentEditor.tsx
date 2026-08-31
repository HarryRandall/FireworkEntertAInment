'use client';

/** Assortment editor: name/description/price/active fields, plus a member catalogue-item picker with quantity. Deliberately no version history / JSON panel / render preview rail — those belong to the firework/effect editors, not this. */

import { useEffect, useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ChevronDown, Copy, Download, QrCode, Trash2 } from 'lucide-react';
import { Button } from '@/components/design-system/Button';
import { Card } from '@/components/design-system/Card';
import { Field, FieldLabel } from '@/components/design-system/Field';
import { Input } from '@/components/design-system/Input';
import { NumberInput } from '@/components/design-system/NumberInput';
import { Toggle } from '@/components/design-system/Toggle';
import { toast } from '@/components/design-system/toast';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatBudget } from '@/lib/show-domain';
import type {
  AdminAssortmentDetail,
  AdminCatalogueItemOption,
} from '@/lib/admin/assortments.server';
import {
  deleteAssortmentItem,
  ensureAssortmentPublicLink,
  searchCatalogueItems,
  updateAssortment,
  upsertAssortmentItem,
} from '@/app/actions/admin-assortments';

export function AssortmentEditor({
  assortment,
  publicUrl,
}: {
  assortment: AdminAssortmentDetail;
  publicUrl: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(assortment.name);
  const [description, setDescription] = useState(assortment.description ?? '');
  const [priceDollars, setPriceDollars] = useState(assortment.priceCents / 100);
  const [isActive, setIsActive] = useState(assortment.isActive);
  const [saving, startSaving] = useTransition();

  function save() {
    startSaving(async () => {
      const result = await updateAssortment({
        id: assortment.id,
        name: name.trim(),
        description: description.trim() || undefined,
        priceCents: Math.round(priceDollars * 100),
        isActive,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Assortment saved');
      router.refresh();
    });
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-6">
        <Card className="space-y-4 p-5">
          <Field>
            <FieldLabel htmlFor="assortment-name">Name</FieldLabel>
            <Input id="assortment-name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="assortment-description">Description</FieldLabel>
            <textarea
              id="assortment-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="border-border bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-3 focus-visible:outline-none"
            />
          </Field>
          <div className="flex flex-wrap items-end gap-6">
            <Field className="w-40">
              <FieldLabel htmlFor="assortment-price">Price (USD)</FieldLabel>
              <NumberInput
                value={priceDollars}
                onChange={setPriceDollars}
                min={0}
                step={0.25}
                ariaLabel="Price in dollars"
              />
            </Field>
            <Toggle
              checked={isActive}
              onChange={setIsActive}
              label="Active"
              description="Visible to kiosk shoppers once on"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={save} loading={saving}>
              Save
            </Button>
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-foreground text-sm font-semibold">
              Products in this pack ({assortment.items.length})
            </h2>
            <p className="font-mono text-xs tabular-nums">{formatBudget(assortment.priceCents)}</p>
          </div>

          <div className="divide-y">
            {assortment.items.map((item) => (
              <AssortmentItemRow key={item.id} assortmentId={assortment.id} item={item} />
            ))}
            {assortment.items.length === 0 ? (
              <p className="text-muted-foreground py-4 text-sm">No products added yet.</p>
            ) : null}
          </div>

          <AddCatalogueItemPicker
            assortmentId={assortment.id}
            existingCatalogueItemIds={assortment.items.map((item) => item.catalogueItemId)}
            nextSortOrder={assortment.items.length}
          />
        </Card>
      </div>

      <AssortmentQrPanel assortment={assortment} publicUrl={publicUrl} />
    </div>
  );
}

function AssortmentQrPanel({
  assortment,
  publicUrl,
}: {
  assortment: AdminAssortmentDetail;
  publicUrl: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function ensureLink() {
    startTransition(async () => {
      const result = await ensureAssortmentPublicLink(assortment.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Reusable QR link created');
      router.refresh();
    });
  }

  async function copyPublicUrl() {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success('Public URL copied');
    } catch {
      toast.error('The public URL could not be copied.');
    }
  }

  return (
    <aside>
      <Card className="sticky top-6 p-5">
        <div className="flex items-center gap-2">
          <QrCode className="text-primary" size={20} aria-hidden="true" />
          <h2 className="font-semibold">Reusable QR code</h2>
        </div>
        <p className="text-muted-foreground mt-2 text-sm leading-6">
          Print this once and reuse it for every copy of the same assortment. Normal assortment
          edits do not change the link.
        </p>

        {!assortment.publicLink ? (
          <Button type="button" className="mt-4 w-full" loading={pending} onClick={ensureLink}>
            Create QR link
          </Button>
        ) : publicUrl ? (
          <>
            <Image
              src={`/api/admin/assortments/${assortment.id}/qr`}
              alt={`QR code for ${assortment.name}`}
              width={512}
              height={512}
              unoptimized
              className="border-border mt-4 aspect-square w-full rounded-xl border bg-white p-2"
            />
            <Field className="mt-4">
              <FieldLabel htmlFor="assortment-public-url">Public URL</FieldLabel>
              <Input
                id="assortment-public-url"
                readOnly
                value={publicUrl}
                className="font-mono text-xs"
              />
            </Field>
            {!assortment.publicLink.isEnabled ? (
              <p className="text-destructive mt-3 text-sm">
                This link is currently revoked and will fail safely for consumers.
              </p>
            ) : null}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button type="button" variant="secondary" onClick={copyPublicUrl}>
                <Copy size={16} aria-hidden="true" />
                Copy URL
              </Button>
              <Button
                href={`/api/admin/assortments/${assortment.id}/qr?download=1`}
                download
                variant="secondary"
              >
                <Download size={16} aria-hidden="true" />
                SVG
              </Button>
            </div>
          </>
        ) : (
          <p className="text-destructive mt-4 text-sm">
            Configure APP_ORIGIN before generating a production QR code.
          </p>
        )}
      </Card>
    </aside>
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
      const result = await upsertAssortmentItem({
        assortmentId,
        catalogueItemId: item.catalogueItemId,
        quantity: next,
        sortOrder: item.sortOrder,
      });
      if (!result.ok) toast.error(result.error);
      else router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteAssortmentItem({ assortmentId, assortmentItemId: item.id });
      if (!result.ok) toast.error(result.error);
      else router.refresh();
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

function AddCatalogueItemPicker({
  assortmentId,
  existingCatalogueItemIds,
  nextSortOrder,
}: {
  assortmentId: string;
  existingCatalogueItemIds: string[];
  nextSortOrder: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<AdminCatalogueItemOption[]>([]);
  const [adding, startAdding] = useTransition();
  const requestTokenRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    const token = requestTokenRef.current + 1;
    requestTokenRef.current = token;
    const timeout = setTimeout(() => {
      void searchCatalogueItems(query).then((results) => {
        if (requestTokenRef.current === token) setOptions(results);
      });
    }, 200);
    return () => clearTimeout(timeout);
  }, [open, query]);

  function addItem(catalogueItemId: string) {
    startAdding(async () => {
      const result = await upsertAssortmentItem({
        assortmentId,
        catalogueItemId,
        quantity: 1,
        sortOrder: nextSortOrder,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      setQuery('');
      router.refresh();
    });
  }

  const existing = new Set(existingCatalogueItemIds);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="secondary" className="w-full justify-between">
          Add a product
          <ChevronDown size={15} aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(28rem,calc(100vw-2rem))] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search name or part number…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-72">
            <CommandEmpty>No catalogue items match that search.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.id}
                  disabled={existing.has(option.id) || adding}
                  onSelect={() => addItem(option.id)}
                  className="items-start gap-3 px-3 py-2.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{option.name}</span>
                    <span className="text-muted-foreground mt-0.5 block truncate font-mono text-xs">
                      {option.partNumber}
                      {option.cheapestPriceCents != null
                        ? ` · ${formatBudget(option.cheapestPriceCents)}`
                        : ' · no supplier price'}
                    </span>
                  </span>
                  {existing.has(option.id) ? (
                    <span className="text-muted-foreground text-xs">Added</span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
