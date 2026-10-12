'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { ArrowDownUp, Check, ChevronDown, ListFilter, Search, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/ui/patterns/Button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/ui/primitives/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/primitives/popover';
import { CATALOGUE_SORT_OPTIONS } from '@/lib/catalogue-browse';
import { MANUFACTURER_FILTER_NONE } from '@/lib/show-domain';
import { cn } from '@/lib/utils';

const KIND_FILTER_OPTIONS = [
  { label: 'Single shot', value: 'single' },
  { label: 'Multi-shot', value: 'multishot' },
];

const SORT_FILTER_OPTIONS = CATALOGUE_SORT_OPTIONS;

const MANUFACTURER_FILTER_OPTIONS = [
  { label: 'HA', value: 'HA' },
  { label: 'Digitally created', value: MANUFACTURER_FILTER_NONE },
];

export type CatalogueToolbarValues = {
  q: string;
  kind: string;
  manufacturer: string;
  duration_min: string;
  duration_max: string;
  caliber: string;
  price_max: string;
  sort: string;
  /** Set by the effect and colour chips; carried through so toolbar edits keep them. */
  effect: string;
  colour: string;
};

type CatalogueToolbarProps = {
  values: CatalogueToolbarValues;
  caliberOptions: { label: string; value: string }[];
};

const SEARCH_DEBOUNCE_MS = 250;

function sameValues(a: CatalogueToolbarValues, b: CatalogueToolbarValues) {
  return (Object.keys(a) as (keyof CatalogueToolbarValues)[]).every(
    (key) => a[key].trim() === b[key].trim(),
  );
}

export function CatalogueToolbar({ values, caliberOptions }: CatalogueToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [draft, setDraft] = useState(values);
  const [, startTransition] = useTransition();
  const hasQuery = draft.q.trim().length > 0;

  useEffect(() => {
    setDraft(values);
  }, [values]);

  const update = useCallback(
    (changes: Partial<CatalogueToolbarValues>) =>
      setDraft((current) => ({ ...current, ...changes })),
    [],
  );

  const buildHref = useCallback(
    (next: CatalogueToolbarValues) => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(next)) {
        const normalised = value.trim();
        if (normalised && !(key === 'sort' && normalised === 'name')) params.set(key, normalised);
      }
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
    if (sameValues(draft, values)) return;
    const timer = setTimeout(() => {
      startTransition(() => {
        router.replace(buildHref(draft), { scroll: false });
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, values, buildHref, router]);

  return (
    <section className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto]">
      <label className="relative min-w-0">
        <span className="sr-only">Search catalogue</span>
        <Search
          size={16}
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2"
        />
        <input
          value={draft.q}
          onChange={(event) => update({ q: event.target.value })}
          placeholder="Search fireworks, effects, codes"
          className="border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/45 h-10 w-full rounded-md border pr-11 pl-10 text-sm shadow-xs transition-colors focus:outline-none focus-visible:ring-3"
        />
        {hasQuery ? (
          <button
            type="button"
            onClick={() => update({ q: '' })}
            className="text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:ring-border-emphasis absolute top-1/2 right-2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md transition-colors focus:outline-none focus-visible:ring-2"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        ) : null}
      </label>

      <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-end">
        <FilterDropdown
          ariaLabel="Filter by product type"
          allLabel="All products"
          options={KIND_FILTER_OPTIONS}
          selected={draft.kind}
          onSelect={(kind) => update({ kind })}
        />
        <FilterDropdown
          ariaLabel="Filter by manufacturer"
          allLabel="All manufacturers"
          options={MANUFACTURER_FILTER_OPTIONS}
          selected={draft.manufacturer}
          onSelect={(manufacturer) => update({ manufacturer })}
        />
        {caliberOptions.length > 0 ? (
          <FilterDropdown
            ariaLabel="Filter by calibre"
            allLabel="Any calibre"
            options={caliberOptions}
            selected={draft.caliber}
            onSelect={(caliber) => update({ caliber })}
          />
        ) : null}
        <DurationFilterPopover
          min={draft.duration_min}
          max={draft.duration_max}
          onApply={(nextMin, nextMax) => update({ duration_min: nextMin, duration_max: nextMax })}
        />
        <PriceFilterPopover max={draft.price_max} onApply={(price_max) => update({ price_max })} />
        <FilterDropdown
          ariaLabel="Sort products"
          allLabel={SORT_FILTER_OPTIONS[0].label}
          allValue="name"
          icon="sort"
          options={SORT_FILTER_OPTIONS.slice(1)}
          selected={draft.sort || 'name'}
          onSelect={(sort) => update({ sort })}
        />
      </div>
    </section>
  );
}

function FilterDropdown({
  ariaLabel,
  allLabel,
  allValue = '',
  icon = 'filter',
  options,
  selected,
  onSelect,
}: {
  ariaLabel: string;
  allLabel: string;
  allValue?: string;
  icon?: 'filter' | 'sort';
  options: ReadonlyArray<{ label: string; value: string }>;
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
          {icon === 'sort' ? (
            <ArrowDownUp size={15} className="text-muted-foreground shrink-0" />
          ) : (
            <ListFilter size={15} className="text-muted-foreground shrink-0" />
          )}
          <span className="min-w-0 truncate">{selectedLabel}</span>
          <ChevronDown size={15} className="text-muted-foreground ml-1 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-1">
        <Command>
          <CommandList>
            <CommandEmpty>No filters.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={allLabel}
                onSelect={() => select(allValue)}
                className={cn('rounded-md', selected === allValue && 'text-foreground')}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {selected === allValue ? <Check size={14} /> : null}
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
                    className={cn('rounded-md', isSelected && 'text-foreground')}
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
          <ListFilter size={15} className="text-muted-foreground shrink-0" />
          <span className="min-w-0 truncate">{label}</span>
          <ChevronDown size={15} className="text-muted-foreground ml-1 shrink-0" />
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

function PriceFilterPopover({ max, onApply }: { max: string; onApply: (max: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draftMax, setDraftMax] = useState(max);

  useEffect(() => {
    if (open) setDraftMax(max);
  }, [open, max]);

  const label = max ? `Up to $${max}` : 'Any price';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="md"
          className="h-10 w-fit max-w-full rounded-md px-3"
          aria-label="Filter by price"
        >
          <ListFilter size={15} className="text-muted-foreground shrink-0" />
          <span className="min-w-0 truncate">{label}</span>
          <ChevronDown size={15} className="text-muted-foreground ml-1 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-3">
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            onApply(draftMax);
            setOpen(false);
          }}
        >
          <label className="flex flex-col gap-2">
            <span className="text-foreground text-sm font-medium">Maximum price</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={draftMax}
              onChange={(event) => setDraftMax(event.target.value)}
              placeholder="No limit"
              className="border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/45 h-9 w-full rounded-md border px-2.5 text-sm shadow-xs transition-colors focus:outline-none focus-visible:ring-3"
            />
          </label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="flex-1"
              onClick={() => {
                onApply('');
                setOpen(false);
              }}
            >
              Clear
            </Button>
            <Button type="submit" size="sm" className="flex-1">
              Apply
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
