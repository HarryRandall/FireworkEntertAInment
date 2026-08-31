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
import { MANUFACTURER_FILTER_NONE } from '@/lib/show-domain';
import { cn } from '@/lib/utils';

const KIND_FILTER_OPTIONS = [
  { label: 'Single shot', value: 'single' },
  { label: 'Multi-shot', value: 'multishot' },
];

const MANUFACTURER_FILTER_OPTIONS = [
  { label: 'HA', value: 'HA' },
  { label: 'Digitally created', value: MANUFACTURER_FILTER_NONE },
];

type CatalogueToolbarProps = {
  kind: string;
  manufacturer: string;
  durationMin: string;
  durationMax: string;
  query: string;
};

const SEARCH_DEBOUNCE_MS = 250;

export function CatalogueToolbar({
  kind,
  manufacturer,
  durationMin,
  durationMax,
  query,
}: CatalogueToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [draftQuery, setDraftQuery] = useState(query);
  const [selectedKind, setSelectedKind] = useState(kind);
  const [selectedManufacturer, setSelectedManufacturer] = useState(manufacturer);
  const [selectedDurationMin, setSelectedDurationMin] = useState(durationMin);
  const [selectedDurationMax, setSelectedDurationMax] = useState(durationMax);
  const [, startTransition] = useTransition();
  const hasQuery = draftQuery.trim().length > 0;

  useEffect(() => {
    setDraftQuery(query);
  }, [query]);

  useEffect(() => {
    setSelectedKind(kind);
  }, [kind]);

  useEffect(() => {
    setSelectedManufacturer(manufacturer);
  }, [manufacturer]);

  useEffect(() => {
    setSelectedDurationMin(durationMin);
  }, [durationMin]);

  useEffect(() => {
    setSelectedDurationMax(durationMax);
  }, [durationMax]);

  const buildHref = useCallback(
    (
      nextQuery: string,
      nextKind: string,
      nextManufacturer: string,
      nextDurationMin: string,
      nextDurationMax: string,
    ) => {
      const params = new URLSearchParams();
      const normalisedQuery = nextQuery.trim();

      if (normalisedQuery) params.set('q', normalisedQuery);
      else params.delete('q');

      if (nextKind) params.set('kind', nextKind);
      else params.delete('kind');

      if (nextManufacturer) params.set('manufacturer', nextManufacturer);
      else params.delete('manufacturer');

      if (nextDurationMin) params.set('duration_min', nextDurationMin);
      else params.delete('duration_min');

      if (nextDurationMax) params.set('duration_max', nextDurationMax);
      else params.delete('duration_max');

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
    if (
      draftQuery.trim() === query.trim() &&
      selectedKind === kind &&
      selectedManufacturer === manufacturer &&
      selectedDurationMin === durationMin &&
      selectedDurationMax === durationMax
    )
      return;
    const timer = setTimeout(() => {
      startTransition(() => {
        router.replace(
          buildHref(
            draftQuery,
            selectedKind,
            selectedManufacturer,
            selectedDurationMin,
            selectedDurationMax,
          ),
          { scroll: false },
        );
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [
    draftQuery,
    selectedKind,
    selectedManufacturer,
    selectedDurationMin,
    selectedDurationMax,
    query,
    kind,
    manufacturer,
    durationMin,
    durationMax,
    buildHref,
    router,
  ]);

  function changeQuery(nextQuery: string) {
    setDraftQuery(nextQuery);
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

      <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
        <FilterDropdown
          ariaLabel="Filter by product type"
          allLabel="All products"
          options={KIND_FILTER_OPTIONS}
          selected={selectedKind}
          onSelect={setSelectedKind}
        />
        <FilterDropdown
          ariaLabel="Filter by manufacturer"
          allLabel="All manufacturers"
          options={MANUFACTURER_FILTER_OPTIONS}
          selected={selectedManufacturer}
          onSelect={setSelectedManufacturer}
        />
        <DurationFilterPopover
          min={selectedDurationMin}
          max={selectedDurationMax}
          onApply={(nextMin, nextMax) => {
            setSelectedDurationMin(nextMin);
            setSelectedDurationMax(nextMax);
          }}
        />
      </div>
    </section>
  );
}

function FilterDropdown({
  ariaLabel,
  allLabel,
  options,
  selected,
  onSelect,
}: {
  ariaLabel: string;
  allLabel: string;
  options: { label: string; value: string }[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((option) => option.value === selected)?.label ?? allLabel;

  function select(value: string) {
    onSelect(value);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="md"
          className="h-10 w-fit max-w-full rounded-md px-3"
          aria-label={ariaLabel}
        >
          <ListFilter size={15} className="shrink-0 text-[color:var(--color-content-subtle)]" />
          <span className="min-w-0 truncate">{selectedLabel}</span>
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
                value={allLabel}
                onSelect={() => select('')}
                className={cn(
                  'rounded-md',
                  selected === '' && 'text-[color:var(--color-content-emphasis)]',
                )}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {selected === '' ? <Check size={14} /> : null}
                </span>
                {allLabel}
              </CommandItem>
              {options.map((option) => {
                const isSelected = option.value === selected;
                return (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => select(option.value)}
                    className={cn(
                      'rounded-md',
                      isSelected && 'text-[color:var(--color-content-emphasis)]',
                    )}
                  >
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                      {isSelected ? <Check size={14} /> : null}
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
  );
}

function DurationFilterPopover({
  min,
  max,
  onApply,
}: {
  min: string;
  max: string;
  onApply: (min: string, max: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftMin, setDraftMin] = useState(min);
  const [draftMax, setDraftMax] = useState(max);

  useEffect(() => {
    if (open) {
      setDraftMin(min);
      setDraftMax(max);
    }
  }, [open, min, max]);

  const label = min || max ? `${min || '0'}–${max || '∞'}s` : 'Any duration';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="md"
          className="h-10 w-fit max-w-full rounded-md px-3"
          aria-label="Filter by duration"
        >
          <ListFilter size={15} className="shrink-0 text-[color:var(--color-content-subtle)]" />
          <span className="min-w-0 truncate">{label}</span>
          <ChevronDown
            size={15}
            className="ml-1 shrink-0 text-[color:var(--color-content-subtle)]"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            onApply(draftMin, draftMax);
            setOpen(false);
          }}
        >
          <div className="text-foreground text-sm font-medium">Duration</div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              value={draftMin}
              onChange={(event) => setDraftMin(event.target.value)}
              placeholder="Min"
              aria-label="Minimum duration in seconds"
              className="border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/45 h-9 w-full rounded-md border px-2.5 text-sm shadow-xs transition-colors focus:outline-none focus-visible:ring-3"
            />
            <span className="text-muted-foreground text-xs">to</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              value={draftMax}
              onChange={(event) => setDraftMax(event.target.value)}
              placeholder="Max"
              aria-label="Maximum duration in seconds"
              className="border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/45 h-9 w-full rounded-md border px-2.5 text-sm shadow-xs transition-colors focus:outline-none focus-visible:ring-3"
            />
          </div>
          <Button type="submit" size="sm">
            Apply
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
