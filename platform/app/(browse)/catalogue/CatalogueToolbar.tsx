'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { Check, ChevronDown, ListFilter, Search, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
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

const SEARCH_DEBOUNCE_MS = 250;

export function CatalogueToolbar({ kind, query }: CatalogueToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [draftQuery, setDraftQuery] = useState(query);
  const [selectedKind, setSelectedKind] = useState(kind);
  const [filterOpen, setFilterOpen] = useState(false);
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
      const params = new URLSearchParams();
      const normalisedQuery = nextQuery.trim();

      if (normalisedQuery) params.set('q', normalisedQuery);
      else params.delete('q');

      if (nextKind) params.set('kind', nextKind);
      else params.delete('kind');

      const queryString = params.toString();
      return queryString ? `${pathname}?${queryString}` : pathname;
    },
    [pathname],
  );

  const skipFirstRender = useRef(true);
  useEffect(() => {
    if (skipFirstRender.current) {
      skipFirstRender.current = false;
      return;
    }
    if (draftQuery.trim() === query.trim() && selectedKind === kind) return;
    const timer = setTimeout(() => {
      startTransition(() => {
        router.replace(buildHref(draftQuery, selectedKind), { scroll: false });
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draftQuery, selectedKind, query, kind, buildHref, router]);

  function changeQuery(nextQuery: string) {
    setDraftQuery(nextQuery);
  }

  function changeKind(nextKind: string) {
    setSelectedKind(nextKind);
    setFilterOpen(false);
  }

  return (
    <section className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
      <label className="relative min-w-0">
        <span className="sr-only">Search catalogue</span>
        <Search
          size={16}
          className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[color:var(--color-content-muted)]"
        />
        <input
          value={draftQuery}
          onChange={(event) => changeQuery(event.target.value)}
          placeholder="Search fireworks, effects, codes"
          className="border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/45 h-10 w-full rounded-md border pr-11 pl-10 text-sm shadow-xs transition-colors focus:outline-none focus-visible:ring-3"
        />
        {hasQuery ? (
          <button
            type="button"
            onClick={() => setDraftQuery('')}
            className="absolute top-1/2 right-2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[color:var(--color-content-muted)] transition-colors hover:bg-[color:var(--color-bg-subtle)] hover:text-[color:var(--color-content-default)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-border-strong)]"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        ) : null}
      </label>

      <Popover open={filterOpen} onOpenChange={setFilterOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="secondary"
            size="md"
            className="h-10 w-fit max-w-full justify-self-center rounded-md px-3 sm:justify-self-end"
            aria-label="Filter catalogue"
          >
            <ListFilter size={15} className="shrink-0 text-[color:var(--color-content-subtle)]" />
            <span className="min-w-0 truncate">{selectedKindLabel}</span>
            <ChevronDown
              size={15}
              className="ml-1 shrink-0 text-[color:var(--color-content-subtle)]"
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-52 p-1">
          <Command>
            <CommandList>
              <CommandEmpty>No filters.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="All product types"
                  onSelect={() => changeKind('')}
                  className={cn(
                    'rounded-md',
                    selectedKind === '' && 'text-[color:var(--color-content-emphasis)]',
                  )}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                    {selectedKind === '' ? <Check size={14} /> : null}
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
                        'rounded-md',
                        selected && 'text-[color:var(--color-content-emphasis)]',
                      )}
                    >
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                        {selected ? <Check size={14} /> : null}
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
    </section>
  );
}
