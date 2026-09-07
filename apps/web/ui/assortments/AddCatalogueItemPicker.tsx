'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/ui/patterns/Button';
import { toast } from '@/ui/patterns/toast';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/ui/primitives/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/primitives/popover';
import { formatBudget } from '@/lib/show-domain';
import type { AdminCatalogueItemOption } from '@/lib/admin/assortments.server';
import { searchCatalogueItems, upsertAssortmentItem } from '@/app/actions/admin-assortments';

export function AddCatalogueItemPicker({
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
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<AdminCatalogueItemOption[]>([]);
  const [adding, startAdding] = useTransition();

  useEffect(() => {
    if (!open) return;
    let active = true;
    setSearching(true);
    setSearchError(null);
    setOptions([]);
    const timeout = setTimeout(() => {
      void searchCatalogueItems(query)
        .then((results) => {
          if (active) setOptions(results);
        })
        .catch(() => {
          if (active)
            setSearchError(
              'Products could not be loaded. Close and reopen the picker to try again.',
            );
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [open, query]);

  function addItem(catalogueItemId: string) {
    startAdding(async () => {
      try {
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
      } catch {
        toast.error('The product could not be added. Please try again.');
      }
    });
  }

  const existing = new Set(existingCatalogueItemIds);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          className="w-full justify-between"
          aria-expanded={open}
          disabled={adding}
        >
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
            {searching ? (
              <p role="status" className="text-muted-foreground px-3 py-6 text-center text-sm">
                Loading products…
              </p>
            ) : searchError ? (
              <p role="alert" className="text-destructive px-3 py-6 text-sm">
                {searchError}
              </p>
            ) : (
              <CommandEmpty>No catalogue items match that search.</CommandEmpty>
            )}
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
