'use client';

import { type FormEvent, useCallback, useEffect, useState, useTransition } from 'react';
import { Check, ChevronDown, ListFilter, Plus, Search, X } from 'lucide-react';
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

export type ShowsSortKey = 'updated' | 'cost' | 'length' | 'name';

type ShowsSortOption = {
  key: ShowsSortKey;
  label: string;
};

type ShowsToolbarProps = {
  query: string;
  resultCount: number;
  sort: ShowsSortKey;
  sorts: ShowsSortOption[];
};

function resultLabel(count: number) {
  return `${count.toLocaleString()} ${count === 1 ? 'show' : 'shows'}`;
}

export function ShowsToolbar({ query, resultCount, sort, sorts }: ShowsToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [draftQuery, setDraftQuery] = useState(query);
  const [selectedSort, setSelectedSort] = useState(sort);
  const [, startTransition] = useTransition();
  const hasQuery = draftQuery.trim().length > 0;
  const selectedSortOption = sorts.find((item) => item.key === selectedSort) ?? sorts[0];

  useEffect(() => {
    setDraftQuery(query);
  }, [query]);

  useEffect(() => {
    setSelectedSort(sort);
  }, [sort]);

  const buildHref = useCallback(
    (nextQuery: string, nextSort: ShowsSortKey) => {
      const params = new URLSearchParams(searchParams.toString());
      const normalisedQuery = nextQuery.trim();
      params.delete('page');

      if (normalisedQuery) params.set('q', normalisedQuery);
      else params.delete('q');

      if (nextSort !== 'updated') params.set('sort', nextSort);
      else params.delete('sort');

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
      router.replace(buildHref(draftQuery, selectedSort), { scroll: false });
    });
  }

  function changeSort(nextSort: ShowsSortKey) {
    setSelectedSort(nextSort);
    startTransition(() => {
      router.replace(buildHref(draftQuery, nextSort), { scroll: false });
    });
  }

  function clearSearch() {
    setDraftQuery('');
    startTransition(() => {
      router.replace(buildHref('', selectedSort), { scroll: false });
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-on-surface-variant text-sm">{resultLabel(resultCount)}</p>
        </div>
        <Button href="/shows/new" className="h-11 w-full rounded-full px-5 sm:w-fit">
          <Plus size={16} />
          New show
        </Button>
      </div>

      <form onSubmit={submitSearch} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
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
              aria-label="Sort shows"
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <ListFilter
                  size={16}
                  className="shrink-0 text-[color:var(--color-content-subtle)]"
                />
                <span className="shrink-0 text-[color:var(--color-content-muted)]">Sort</span>
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
      </form>
    </section>
  );
}
