'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { ArrowDownUp, Check, ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/ui/patterns/Button';
import { Command, CommandGroup, CommandItem, CommandList } from '@/ui/primitives/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/primitives/popover';
import { CATALOGUE_SORT_OPTIONS } from '@/lib/catalogue-browse';
import { cn } from '@/lib/utils';

export type CatalogueToolbarValues = {
  q: string;
  kind: string;
  effect: string;
  colour: string;
  caliber: string;
  price_max: string;
  sort: string;
};

type Option = { value: string; label: string; count?: number };

type CatalogueToolbarProps = {
  values: CatalogueToolbarValues;
  effectOptions: Option[];
  colourOptions: Array<Option & { swatch: string }>;
  caliberOptions: Option[];
};

const SEARCH_DEBOUNCE_MS = 250;
const FILTER_KEYS = ['kind', 'effect', 'colour', 'caliber', 'price_max'] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

function sameValues(a: CatalogueToolbarValues, b: CatalogueToolbarValues) {
  return (Object.keys(a) as (keyof CatalogueToolbarValues)[]).every(
    (key) => a[key].trim() === b[key].trim(),
  );
}

/** Search, one Filters menu and sort. Other URL parameters are dropped on change. */
export function CatalogueToolbar({
  values,
  effectOptions,
  colourOptions,
  caliberOptions,
}: CatalogueToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [draft, setDraft] = useState(values);
  const [, startTransition] = useTransition();

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
    <section className="flex flex-col gap-2 sm:flex-row">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">Search catalogue</span>
        <Search
          size={16}
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2"
        />
        <input
          value={draft.q}
          onChange={(event) => update({ q: event.target.value })}
          placeholder="Search fireworks, effects, codes"
          autoComplete="off"
          enterKeyHint="search"
          className="border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/45 h-10 w-full rounded-md border pr-11 pl-10 text-sm shadow-xs transition-colors focus:outline-none focus-visible:ring-3"
        />
        {draft.q.trim() ? (
          <button
            type="button"
            onClick={() => update({ q: '' })}
            className="text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:ring-border-emphasis absolute top-1/2 right-2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md transition-colors focus:outline-none focus-visible:ring-2"
            aria-label="Clear search"
          >
            <X size={14} aria-hidden />
          </button>
        ) : null}
      </label>

      <div className="flex gap-2">
        <FiltersMenu
          values={draft}
          effectOptions={effectOptions}
          colourOptions={colourOptions}
          caliberOptions={caliberOptions}
          onApply={update}
        />
        <SortMenu selected={draft.sort || 'name'} onSelect={(sort) => update({ sort })} />
      </div>
    </section>
  );
}

function SortMenu({ selected, onSelect }: { selected: string; onSelect: (sort: string) => void }) {
  const [open, setOpen] = useState(false);
  const label =
    CATALOGUE_SORT_OPTIONS.find((option) => option.value === selected)?.label ??
    CATALOGUE_SORT_OPTIONS[0].label;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          className="h-10 rounded-md px-3"
          aria-label={`Sort products: ${label}`}
        >
          <ArrowDownUp size={15} aria-hidden className="text-muted-foreground shrink-0" />
          <span className="hidden truncate md:inline">{label}</span>
          <ChevronDown size={15} aria-hidden className="text-muted-foreground shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-1">
        <Command>
          <CommandList>
            <CommandGroup>
              {CATALOGUE_SORT_OPTIONS.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onSelect(option.value);
                    setOpen(false);
                  }}
                  className="rounded-md"
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                    {option.value === selected ? <Check size={14} /> : null}
                  </span>
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const TYPE_OPTIONS: Option[] = [
  { value: '', label: 'All' },
  { value: 'single', label: 'Single shot' },
  { value: 'multishot', label: 'Multi-shot cake' },
];

function FiltersMenu({
  values,
  effectOptions,
  colourOptions,
  caliberOptions,
  onApply,
}: {
  values: CatalogueToolbarValues;
  effectOptions: Option[];
  colourOptions: Array<Option & { swatch: string }>;
  caliberOptions: Option[];
  onApply: (changes: Pick<CatalogueToolbarValues, FilterKey>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => pickFilters(values));
  const activeCount = FILTER_KEYS.filter((key) => values[key]).length;

  useEffect(() => {
    if (open) setDraft(pickFilters(values));
  }, [open, values]);

  const set = (key: FilterKey, value: string) =>
    setDraft((current) => ({ ...current, [key]: current[key] === value ? '' : value }));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="secondary" className="h-10 rounded-md px-3">
          <SlidersHorizontal size={15} aria-hidden className="text-muted-foreground shrink-0" />
          Filters
          {activeCount > 0 ? (
            <span className="bg-foreground text-background inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs tabular-nums">
              {activeCount}
              <span className="sr-only"> active</span>
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onApply(draft);
            setOpen(false);
          }}
        >
          <div className="flex max-h-[min(32rem,70vh)] flex-col gap-5 overflow-y-auto p-4">
            <FilterSection title="Type">
              {TYPE_OPTIONS.map((option) => (
                <Pill
                  key={option.value || 'all'}
                  active={draft.kind === option.value}
                  onClick={() => setDraft((current) => ({ ...current, kind: option.value }))}
                >
                  {option.label}
                </Pill>
              ))}
            </FilterSection>

            {colourOptions.length > 0 ? (
              <FilterSection title="Colour">
                {colourOptions.map((option) => (
                  <Pill
                    key={option.value}
                    active={draft.colour === option.value}
                    onClick={() => set('colour', option.value)}
                  >
                    <span
                      aria-hidden
                      className="border-border h-3 w-3 rounded-full border"
                      style={{ backgroundColor: option.swatch }}
                    />
                    {option.label}
                  </Pill>
                ))}
              </FilterSection>
            ) : null}

            {effectOptions.length > 0 ? (
              <FilterSection title="Effect">
                {effectOptions.map((option) => (
                  <Pill
                    key={option.value}
                    active={draft.effect === option.value}
                    onClick={() => set('effect', option.value)}
                  >
                    {option.label}
                  </Pill>
                ))}
              </FilterSection>
            ) : null}

            {caliberOptions.length > 0 ? (
              <FilterSection title="Calibre">
                {caliberOptions.map((option) => (
                  <Pill
                    key={option.value}
                    active={draft.caliber === option.value}
                    onClick={() => set('caliber', option.value)}
                  >
                    {option.label}
                  </Pill>
                ))}
              </FilterSection>
            ) : null}

            <label className="flex flex-col gap-2">
              <span className="text-foreground text-xs font-medium">Maximum price</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={draft.price_max}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, price_max: event.target.value }))
                }
                placeholder="No limit"
                className="border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/45 h-9 w-full rounded-md border px-2.5 text-sm shadow-xs transition-colors focus:outline-none focus-visible:ring-3"
              />
            </label>
          </div>

          <div className="border-border flex gap-2 border-t p-3">
            <Button
              type="button"
              variant="ghost"
              className="flex-1"
              onClick={() => setDraft(emptyFilters())}
            >
              Clear all
            </Button>
            <Button type="submit" className="flex-1">
              Show results
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function pickFilters(values: CatalogueToolbarValues): Pick<CatalogueToolbarValues, FilterKey> {
  return {
    kind: values.kind,
    effect: values.effect,
    colour: values.colour,
    caliber: values.caliber,
    price_max: values.price_max,
  };
}

function emptyFilters(): Pick<CatalogueToolbarValues, FilterKey> {
  return { kind: '', effect: '', colour: '', caliber: '', price_max: '' };
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-foreground mb-2 text-xs font-medium">{title}</legend>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </fieldset>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'focus-visible:ring-ring/45 inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors focus:outline-none focus-visible:ring-2',
        active
          ? 'border-foreground bg-foreground text-background'
          : 'border-border text-muted-foreground hover:text-foreground hover:border-border-emphasis',
      )}
    >
      {children}
    </button>
  );
}
