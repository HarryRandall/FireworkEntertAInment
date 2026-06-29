'use client';

import { type FormEvent, useCallback, useEffect, useState, useTransition } from 'react';
import { Check, ChevronDown, ListFilter, Search, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/app/components/ui/Button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const FILTER_OPTIONS = [
  { label: 'Single shot', value: 'single' },
  { label: 'Multi-shot', value: 'multishot' },
];

type CatalogueToolbarProps = {
  kind: string;
  query: string;
};

export function CatalogueToolbar({ kind, query }: CatalogueToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [draftQuery, setDraftQuery] = useState(query);
  const [selectedKind, setSelectedKind] = useState(kind);
  const [, startTransition] = useTransition();
  const hasQuery = draftQuery.trim().length > 0;
  const selectedKindLabel =
    FILTER_OPTIONS.find((option) => option.value === selectedKind)?.label ?? 'All products';

  useEffect(() => {
    setDraftQuery(query);
  }, [query]);

  useEffect(() => {
    setSelectedKind(kind);
  }, [kind]);

  const buildHref = useCallback(
    (nextQuery: string, nextKind: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const normalisedQuery = nextQuery.trim();

      if (normalisedQuery) params.set('q', normalisedQuery);
      else params.delete('q');

      if (nextKind) params.set('kind', nextKind);
      else params.delete('kind');

      const queryString = params.toString();
      return queryString ? `${pathname}?${queryString}` : pathname;
    },
    [pathname, searchParams],
  );

  function changeQuery(nextQuery: string) {
    setDraftQuery(nextQuery);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(() => {
      router.replace(buildHref(draftQuery, selectedKind), { scroll: false });
    });
  }

  function changeKind(nextKind: string) {
    setSelectedKind(nextKind);
    startTransition(() => {
      router.replace(buildHref(draftQuery, nextKind), { scroll: false });
    });
  }

  function clearSearch() {
    setDraftQuery('');
    startTransition(() => {
      router.replace(buildHref('', selectedKind), { scroll: false });
    });
  }

  return (
    <form onSubmit={submitSearch} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
      <label className="relative min-w-0">
        <span className="sr-only">Search catalogue</span>
        <Search
          size={16}
          className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[color:var(--color-content-muted)]"
        />
        <input
          value={draftQuery}
          onChange={(event) => changeQuery(event.target.value)}
          placeholder="Search name, effect, code"
          className="border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/45 h-11 w-full rounded-xl border pr-12 pl-11 text-sm shadow-xs transition-colors focus:outline-none focus-visible:ring-3"
        />
        {hasQuery ? (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute top-1/2 right-3 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[color:var(--color-content-muted)] transition-colors hover:bg-[color:var(--color-bg-subtle)] hover:text-[color:var(--color-content-default)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-border-strong)]"
            aria-label="Clear search"
          >
            <X size={15} />
          </button>
        ) : null}
      </label>

      <Button type="submit" variant="secondary" className="h-11 rounded-xl px-4">
        <Search size={16} />
        Search
      </Button>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="secondary"
            className="h-11 justify-between rounded-xl px-4 sm:min-w-36"
            aria-label="Filter catalogue"
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <ListFilter size={16} className="shrink-0 text-[color:var(--color-content-subtle)]" />
              <span className="min-w-0 truncate">{selectedKindLabel}</span>
            </span>
            <ChevronDown size={16} className="shrink-0 text-[color:var(--color-content-subtle)]" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-60 rounded-xl p-1.5">
          <Command>
            <CommandList>
              <CommandEmpty>No filters.</CommandEmpty>
              <CommandGroup heading="Product type">
                <CommandItem
                  value="All product types"
                  onSelect={() => changeKind('')}
                  className={cn(
                    'rounded-xl px-3 py-2.5 text-sm',
                    selectedKind === '' && 'text-[color:var(--color-content-emphasis)]',
                  )}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                    {selectedKind === '' ? <Check size={15} /> : null}
                  </span>
                  All products
                </CommandItem>
                {FILTER_OPTIONS.map((option) => {
                  const selected = option.value === selectedKind;
                  return (
                    <CommandItem
                      key={option.value}
                      value={option.label}
                      onSelect={() => changeKind(option.value)}
                      className={cn(
                        'rounded-xl px-3 py-2.5 text-sm',
                        selected && 'text-[color:var(--color-content-emphasis)]',
                      )}
                    >
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                        {selected ? <Check size={15} /> : null}
                      </span>
                      {option.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </form>
  );
}
