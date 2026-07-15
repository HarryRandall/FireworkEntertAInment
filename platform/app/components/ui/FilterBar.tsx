'use client';

/** Search and filter controls bound to URL search parameters for paginated routes. */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ListFilter, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from './Badge';
import { Button } from './Button';
import { Input } from './Input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

export type FilterOption = { value: string; label: string };

export type FilterConfig =
  | {
      key: string;
      label: string;
      type: 'select';
      options: FilterOption[];
    }
  | {
      key: string;
      label: string;
      type: 'range';
      minPlaceholder?: string;
      maxPlaceholder?: string;
      unit?: string;
    };

type FilterBarProps = {
  searchKey?: string;
  searchPlaceholder?: string;
  filters?: FilterConfig[];
  action?: ReactNode;
  className?: string;
};

export function FilterBar({
  searchKey = 'q',
  searchPlaceholder = 'Search…',
  filters = [],
  action,
  className,
}: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchParamsRef = useRef(searchParams.toString());

  const initialSearch = searchParams.get(searchKey) ?? '';
  const [searchValue, setSearchValue] = useState(initialSearch);

  useEffect(() => {
    searchParamsRef.current = searchParams.toString();
    if (debounceRef.current === null) {
      setSearchValue(searchParams.get(searchKey) ?? '');
    }
  }, [searchKey, searchParams]);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const updateParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParamsRef.current);
      mutate(params);
      params.delete('page');
      const query = params.toString();
      searchParamsRef.current = query;
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      });
    },
    [pathname, router],
  );

  const onSearchChange = (value: string) => {
    setSearchValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      updateParams((p) => {
        if (value) p.set(searchKey, value);
        else p.delete(searchKey);
      });
    }, 250);
  };

  const activeFilters = useMemo(() => {
    const out: { config: FilterConfig; chip: string }[] = [];
    for (const filter of filters) {
      if (filter.type === 'select') {
        const val = searchParams.get(filter.key);
        if (val) {
          const opt = filter.options.find((o) => o.value === val);
          if (opt) out.push({ config: filter, chip: `${filter.label}: ${opt.label}` });
        }
      } else if (filter.type === 'range') {
        const min = searchParams.get(`${filter.key}_min`);
        const max = searchParams.get(`${filter.key}_max`);
        if (min || max) {
          const unit = filter.unit ?? '';
          const parts = [min ? `≥${min}${unit}` : null, max ? `≤${max}${unit}` : null].filter(
            Boolean,
          );
          out.push({ config: filter, chip: `${filter.label}: ${parts.join(' ')}` });
        }
      }
    }
    return out;
  }, [filters, searchParams]);

  const hasAnyActive = activeFilters.length > 0 || Boolean(searchParams.get(searchKey));

  const clearAll = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setSearchValue('');
    updateParams((p) => {
      p.delete(searchKey);
      for (const f of filters) {
        if (f.type === 'select') p.delete(f.key);
        else {
          p.delete(`${f.key}_min`);
          p.delete(`${f.key}_max`);
        }
      }
    });
  };

  const clearFilter = (config: FilterConfig) => {
    updateParams((p) => {
      if (config.type === 'select') p.delete(config.key);
      else {
        p.delete(`${config.key}_min`);
        p.delete(`${config.key}_max`);
      }
    });
  };

  return (
    <div
      className={cn('flex flex-col gap-3', className)}
      data-pending={isPending || undefined}
      aria-busy={isPending}
    >
      <span className="sr-only" role="status" aria-live="polite">
        {isPending ? 'Updating results…' : ''}
      </span>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <Input
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            type="search"
            name={searchKey}
            autoComplete="off"
            spellCheck={false}
            placeholder={searchPlaceholder}
            iconLeft={<Search size={16} aria-hidden="true" />}
            aria-label="Search"
          />
        </div>
        {action ? (
          <div className="shrink-0">{action}</div>
        ) : filters.length > 0 ? (
          <FilterPopover
            filters={filters}
            updateParams={updateParams}
            searchParams={searchParams}
          />
        ) : null}
      </div>

      {hasAnyActive ? (
        <div className="flex flex-wrap items-center gap-2">
          {activeFilters.map(({ config, chip }) => (
            <button
              key={config.key}
              type="button"
              onClick={() => clearFilter(config)}
              className="group"
              aria-label={`Remove filter ${chip}`}
            >
              <Badge tone="neutral" solid className="gap-1 pr-1">
                {chip}
                <X
                  size={12}
                  className="text-muted-foreground group-hover:text-foreground ml-1"
                  aria-hidden="true"
                />
              </Badge>
            </button>
          ))}
          {hasAnyActive ? (
            <Button variant="ghost" size="sm" onClick={clearAll}>
              Clear all
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FilterPopover({
  filters,
  updateParams,
  searchParams,
}: {
  filters: FilterConfig[];
  updateParams: (m: (p: URLSearchParams) => void) => void;
  searchParams: URLSearchParams;
}) {
  const [open, setOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterConfig | null>(null);

  useEffect(() => {
    if (!open) setActiveFilter(null);
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="md">
          <ListFilter size={16} aria-hidden="true" />
          Filter
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        {activeFilter === null ? (
          <Command>
            <CommandInput placeholder="Find filter…" />
            <CommandList>
              <CommandEmpty>No filters.</CommandEmpty>
              <CommandGroup>
                {filters.map((filter) => (
                  <CommandItem
                    key={filter.key}
                    value={filter.label}
                    onSelect={() => setActiveFilter(filter)}
                  >
                    {filter.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        ) : activeFilter.type === 'select' ? (
          <Command>
            <FilterPopoverBackButton label="All filters" onClick={() => setActiveFilter(null)} />
            <CommandInput placeholder={`Filter by ${activeFilter.label.toLowerCase()}…`} />
            <CommandList>
              <CommandEmpty>No options.</CommandEmpty>
              <CommandGroup>
                {activeFilter.options.map((opt) => {
                  const selected = searchParams.get(activeFilter.key) === opt.value;
                  return (
                    <CommandItem
                      key={opt.value}
                      value={opt.label}
                      onSelect={() => {
                        updateParams((p) => {
                          if (selected) p.delete(activeFilter.key);
                          else p.set(activeFilter.key, opt.value);
                        });
                      }}
                    >
                      <span
                        className={cn(
                          'mr-2 h-2 w-2 rounded-full',
                          selected ? 'bg-primary' : 'ring-border bg-transparent ring-1',
                        )}
                      />
                      {opt.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        ) : (
          <RangeFilterPanel
            filter={activeFilter}
            searchParams={searchParams}
            updateParams={updateParams}
            onBack={() => setActiveFilter(null)}
            onClose={() => setOpen(false)}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

function FilterPopoverBackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring mx-1 mt-1 flex h-8 items-center gap-2 rounded-md px-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-3"
    >
      <ArrowLeft size={14} aria-hidden="true" />
      {label}
    </button>
  );
}

function RangeFilterPanel({
  filter,
  searchParams,
  updateParams,
  onBack,
  onClose,
}: {
  filter: Extract<FilterConfig, { type: 'range' }>;
  searchParams: URLSearchParams;
  updateParams: (m: (p: URLSearchParams) => void) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const [min, setMin] = useState(searchParams.get(`${filter.key}_min`) ?? '');
  const [max, setMax] = useState(searchParams.get(`${filter.key}_max`) ?? '');

  return (
    <form
      className="flex flex-col gap-3 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        updateParams((p) => {
          if (min) p.set(`${filter.key}_min`, min);
          else p.delete(`${filter.key}_min`);
          if (max) p.set(`${filter.key}_max`, max);
          else p.delete(`${filter.key}_max`);
        });
        onClose();
      }}
    >
      <FilterPopoverBackButton label="All filters" onClick={onBack} />
      <div className="text-foreground text-sm font-medium">{filter.label}</div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          name={`${filter.key}_min`}
          inputMode="decimal"
          autoComplete="off"
          value={min}
          onChange={(e) => setMin(e.target.value)}
          placeholder={filter.minPlaceholder ?? 'Min'}
          aria-label={`${filter.label} minimum`}
        />
        <span className="text-muted-foreground text-xs">to</span>
        <Input
          type="number"
          name={`${filter.key}_max`}
          inputMode="decimal"
          autoComplete="off"
          value={max}
          onChange={(e) => setMax(e.target.value)}
          placeholder={filter.maxPlaceholder ?? 'Max'}
          aria-label={`${filter.label} maximum`}
        />
      </div>
      <Button type="submit" size="sm">
        Apply
      </Button>
    </form>
  );
}
