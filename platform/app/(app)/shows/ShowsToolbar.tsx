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

export type ShowsSortKey = 'updated' | 'cost' | 'length' | 'name';

type ShowsSortOption = {
  key: ShowsSortKey;
  label: string;
};

type ShowsToolbarProps = {
  query: string;
  sort: ShowsSortKey;
  sorts: ShowsSortOption[];
};

// Search-as-you-type debounce: the URL (and the streamed grid) updates shortly
// after the user stops typing, without a separate "Search" button.
const SEARCH_DEBOUNCE_MS = 250;

export function ShowsToolbar({ query, sort, sorts }: ShowsToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [draftQuery, setDraftQuery] = useState(query);
  const [selectedSort, setSelectedSort] = useState(sort);
  const [sortOpen, setSortOpen] = useState(false);
  const [, startTransition] = useTransition();
  const selectedSortOption = sorts.find((item) => item.key === selectedSort) ?? sorts[0];
  const hasQuery = draftQuery.trim().length > 0;

  useEffect(() => {
    setDraftQuery(query);
  }, [query]);

  useEffect(() => {
    setSelectedSort(sort);
  }, [sort]);

  // Build the target URL from only q + sort (page resets to 1 on a search/sort
  // change). Deliberately does NOT read useSearchParams() so the callback stays
  // stable across renders, otherwise the debounce effect below would re-fire on
  // every URL change and spin into a navigation loop.
  const buildHref = useCallback(
    (nextQuery: string, nextSort: ShowsSortKey) => {
      const params = new URLSearchParams();
      const normalisedQuery = nextQuery.trim();
      if (normalisedQuery) params.set('q', normalisedQuery);
      if (nextSort !== 'updated') params.set('sort', nextSort);
      const queryString = params.toString();
      return queryString ? `${pathname}?${queryString}` : pathname;
    },
    [pathname],
  );

  // Keep the URL in sync with the draft query + sort shortly after either
  // changes. The guard compares the draft to the current URL state (the query
  // and sort props) and skips when they already match, so a navigation that
  // updates the props does not re-trigger another navigation (no loop). Page
  // changes don't touch q/sort, so pagination is left intact.
  const skipFirstRender = useRef(true);
  useEffect(() => {
    if (skipFirstRender.current) {
      skipFirstRender.current = false;
      return;
    }
    if (draftQuery.trim() === query.trim() && selectedSort === sort) return;
    const timer = setTimeout(() => {
      startTransition(() => {
        router.replace(buildHref(draftQuery, selectedSort), { scroll: false });
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draftQuery, selectedSort, query, sort, buildHref, router]);

  function changeQuery(nextQuery: string) {
    setDraftQuery(nextQuery);
  }

  function changeSort(nextSort: ShowsSortKey) {
    setSelectedSort(nextSort);
    setSortOpen(false);
  }

  function clearSearch() {
    setDraftQuery('');
  }

  return (
    <section className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="relative min-w-0">
          <span className="sr-only">Search shows</span>
          <Search
            size={17}
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[color:var(--color-content-muted)]"
          />
          <input
            value={draftQuery}
            onChange={(event) => changeQuery(event.target.value)}
            placeholder="Search shows or songs"
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

        <Popover open={sortOpen} onOpenChange={setSortOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="secondary"
              className="h-11 justify-between rounded-xl px-4 sm:min-w-36"
              aria-label="Sort shows"
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <ListFilter
                  size={16}
                  className="shrink-0 text-[color:var(--color-content-subtle)]"
                />
                <span className="min-w-0 truncate">{selectedSortOption.label}</span>
              </span>
              <ChevronDown
                size={16}
                className="shrink-0 text-[color:var(--color-content-subtle)]"
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 rounded-xl p-1.5">
            <Command>
              <CommandList>
                <CommandEmpty>No sort options.</CommandEmpty>
                <CommandGroup>
                  {sorts.map((item) => {
                    const selected = item.key === selectedSort;
                    return (
                      <CommandItem
                        key={item.key}
                        value={item.label}
                        onSelect={() => changeSort(item.key)}
                        className={cn(
                          'rounded-xl px-3 py-2.5 text-sm',
                          selected && 'text-[color:var(--color-content-emphasis)]',
                        )}
                      >
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                          {selected ? <Check size={15} /> : null}
                        </span>
                        {item.label}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </section>
  );
}
