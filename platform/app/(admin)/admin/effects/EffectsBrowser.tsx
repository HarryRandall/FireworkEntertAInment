'use client';

/**
 * Client-side browser for the admin Effects and Style defaults tabs.
 *
 * Both datasets are small and fetched once on the server, so all searching,
 * filtering, and tab switching happen instantly in the browser with no extra
 * round-trips. Filters live behind a compact popover and creation happens in a
 * dialog, keeping the page itself minimal: a tab switch, a search box, and the
 * table.
 */

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, ListFilter, Plus, Search, Sparkles } from 'lucide-react';
import { EffectPreviewIcon } from '@/app/components/admin/EffectPreviewIcon';
import { createCustomStarEffect } from '@/app/actions/admin-effects';
import { createStyleDefaultFromKind } from '@/app/actions/admin-style-defaults';
import { Badge } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import {
  DataTableShell,
  tableCellClasses,
  tableClasses,
  tableHeadClasses,
  tableHeaderCellClasses,
  tableRowClasses,
} from '@/app/components/ui/DataTable';
import { Input } from '@/app/components/ui/Input';
import { SelectField } from '@/app/components/ui/SelectField';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  FIREWORK_STYLE_DEFAULT_KINDS,
  styleDefaultKindLabel,
  type FireworkStyleDefaultKind,
} from '@/lib/fireworks/style-defaults';
import { formatStableDateTime } from '@/lib/show-domain';
import type { AdminEffectSummary, AdminStyleDefaultSummary } from '@/lib/admin.types';
import { cn } from '@/lib/utils';

type EffectsTab = 'effects' | 'defaults';

type Props = {
  effects: AdminEffectSummary[];
  styleDefaults: AdminStyleDefaultSummary[];
  initialTab: EffectsTab;
};

const ALL = '__all';

const NEW_EFFECT_FAMILIES: Option[] = [
  { value: 'aerial_burst', label: 'Aerial burst' },
  { value: 'ascending', label: 'Ascending' },
  { value: 'ground', label: 'Ground' },
  { value: 'noise', label: 'Noise' },
  { value: 'compound', label: 'Compound' },
];

function styleDefaultBadgeTone(kind: FireworkStyleDefaultKind) {
  switch (kind) {
    case 'star':
      return 'violet' as const;
    case 'trail':
      return 'sky' as const;
    case 'launch':
      return 'info' as const;
    case 'smoke':
      return 'neutral' as const;
    case 'strobe':
      return 'primary' as const;
    case 'crackle':
      return 'amber-soft' as const;
    case 'split':
      return 'warning' as const;
    case 'sound':
      return 'success' as const;
  }
}

function formatEffectFamily(value: string) {
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function matches(query: string, parts: (string | null | undefined)[]) {
  if (!query) return true;
  const haystack = parts.filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(query);
}

type Option = { value: string; label: string };

function FilterPopover({
  activeCount,
  onReset,
  children,
}: {
  activeCount: number;
  onReset: () => void;
  children: React.ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="md" className="shrink-0">
          <ListFilter size={16} />
          Filter
          {activeCount > 0 ? (
            <span className="bg-primary text-primary-foreground ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-medium tabular-nums">
              {activeCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 gap-3">
        <div className="flex items-center justify-between">
          <span className="text-foreground text-sm font-medium">Filters</span>
          {activeCount > 0 ? (
            <button
              type="button"
              onClick={onReset}
              className="text-muted-foreground hover:text-foreground text-xs font-medium"
            >
              Reset
            </button>
          ) : null}
        </div>
        {children}
      </PopoverContent>
    </Popover>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: Option[];
  onChange: (value: string | null) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      <SelectField
        value={value ?? ALL}
        ariaLabel={label}
        onChange={(next) => onChange(next === ALL ? null : next)}
        options={[{ value: ALL, label: `All ${label.toLowerCase()}` }, ...options]}
      />
    </label>
  );
}

function Tabs({ value, onChange }: { value: EffectsTab; onChange: (tab: EffectsTab) => void }) {
  const options: { value: EffectsTab; label: string }[] = [
    { value: 'effects', label: 'Effects' },
    { value: 'defaults', label: 'Style defaults' },
  ];
  return (
    <div
      className="border-border bg-background inline-flex h-10 shrink-0 items-center rounded-lg border p-1 shadow-xs"
      role="tablist"
      aria-label="Effects view"
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'focus-visible:ring-ring/50 inline-flex h-8 items-center rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-3',
              selected
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function CreateEffectAction() {
  const [family, setFamily] = useState('aerial_burst');
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" size="md">
          <Plus size={16} />
          New custom effect
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New custom effect</DialogTitle>
          <DialogDescription>
            Pick a family to start from. The effect opens in the editor so you can shape it.
          </DialogDescription>
        </DialogHeader>
        <form action={createCustomStarEffect} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-xs font-medium">Name (optional)</span>
            <Input name="name" placeholder="Custom Star" aria-label="Effect name" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-xs font-medium">Family</span>
            <SelectField
              name="family"
              value={family}
              ariaLabel="Effect family"
              onChange={setFamily}
              options={NEW_EFFECT_FAMILIES}
            />
          </label>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit">Create effect</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StyleDefaultCreateAction() {
  const [kind, setKind] = useState<FireworkStyleDefaultKind>('star');
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" size="md">
          <Plus size={16} />
          Add new
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New style default</DialogTitle>
          <DialogDescription>
            Choose the kind of style default to create. You can adjust its values after it opens.
          </DialogDescription>
        </DialogHeader>
        <form action={createStyleDefaultFromKind} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-xs font-medium">Kind</span>
            <SelectField
              name="kind"
              value={kind}
              ariaLabel="Style default kind"
              onChange={(next) => setKind(next as FireworkStyleDefaultKind)}
              options={FIREWORK_STYLE_DEFAULT_KINDS.map((value) => ({
                value,
                label: styleDefaultKindLabel(value),
              }))}
            />
          </label>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit">Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EffectsBrowser({ effects, styleDefaults, initialTab }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [tab, setTab] = useState<EffectsTab>(initialTab);
  const [query, setQuery] = useState('');
  const [familyFilter, setFamilyFilter] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<string | null>(null);

  const normalisedQuery = query.trim().toLowerCase();

  const familyOptions = useMemo<Option[]>(() => {
    const values = Array.from(new Set(effects.map((effect) => effect.family)));
    return values
      .map((value) => ({ value, label: formatEffectFamily(value) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [effects]);

  const sourceOptions = useMemo<Option[]>(() => {
    const values = Array.from(new Set(effects.map((effect) => effect.source)));
    return values
      .map((value) => ({ value, label: value }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [effects]);

  const kindOptions = useMemo<Option[]>(() => {
    const present = new Set(styleDefaults.map((item) => item.kind));
    return FIREWORK_STYLE_DEFAULT_KINDS.filter((kind) => present.has(kind)).map((kind) => ({
      value: kind,
      label: styleDefaultKindLabel(kind),
    }));
  }, [styleDefaults]);

  const filteredEffects = useMemo(() => {
    return effects.filter((effect) => {
      const matchesQuery = matches(normalisedQuery, [
        effect.name,
        effect.slug,
        effect.description,
        formatEffectFamily(effect.family),
        effect.patternKey,
        effect.source,
      ]);
      const matchesFamily = !familyFilter || effect.family === familyFilter;
      const matchesSource = !sourceFilter || effect.source === sourceFilter;
      return matchesQuery && matchesFamily && matchesSource;
    });
  }, [effects, normalisedQuery, familyFilter, sourceFilter]);

  const filteredDefaults = useMemo(() => {
    return styleDefaults.filter((item) => {
      const matchesQuery = matches(normalisedQuery, [
        item.name,
        item.slug,
        item.description,
        styleDefaultKindLabel(item.kind),
      ]);
      const matchesKind = !kindFilter || item.kind === kindFilter;
      return matchesQuery && matchesKind;
    });
  }, [styleDefaults, normalisedQuery, kindFilter]);

  const open = (href: string) => {
    startTransition(() => router.push(href));
  };

  const effectsActive = tab === 'effects';
  const activeFilterCount = effectsActive
    ? (familyFilter ? 1 : 0) + (sourceFilter ? 1 : 0)
    : kindFilter
      ? 1
      : 0;

  const resetFilters = () => {
    setFamilyFilter(null);
    setSourceFilter(null);
    setKindFilter(null);
  };

  const totalCount = effectsActive ? effects.length : styleDefaults.length;
  const visibleCount = effectsActive ? filteredEffects.length : filteredDefaults.length;
  const itemLabel = effectsActive ? 'effect' : 'style default';

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <Tabs
          value={tab}
          onChange={(next) => {
            setTab(next);
            setQuery('');
            resetFilters();
          }}
        />
        {effectsActive ? <CreateEffectAction /> : <StyleDefaultCreateAction />}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={effectsActive ? 'Search effects…' : 'Search style defaults…'}
            iconLeft={<Search size={16} />}
            aria-label="Search"
          />
        </div>
        <FilterPopover activeCount={activeFilterCount} onReset={resetFilters}>
          {effectsActive ? (
            <>
              <FilterSelect
                label="Family"
                value={familyFilter}
                options={familyOptions}
                onChange={setFamilyFilter}
              />
              <FilterSelect
                label="Source"
                value={sourceFilter}
                options={sourceOptions}
                onChange={setSourceFilter}
              />
            </>
          ) : (
            <FilterSelect
              label="Kind"
              value={kindFilter}
              options={kindOptions}
              onChange={setKindFilter}
            />
          )}
        </FilterPopover>
      </div>

      <DataTableShell
        viewport
        footer={
          <p className="text-muted-foreground text-sm">
            Viewing <span className="text-foreground font-medium tabular-nums">{visibleCount}</span>{' '}
            of <span className="tabular-nums">{totalCount}</span>{' '}
            {totalCount === 1 ? itemLabel : `${itemLabel}s`}
          </p>
        }
      >
        {effectsActive ? (
          <table className={tableClasses('min-w-[920px]')}>
            <thead className={tableHeadClasses()}>
              <tr>
                <th className={tableHeaderCellClasses()}>Effect</th>
                <th className={tableHeaderCellClasses()}>Family</th>
                <th className={tableHeaderCellClasses()}>Pattern</th>
                <th className={tableHeaderCellClasses()}>Source</th>
                <th className={tableHeaderCellClasses('text-right')}>Variants</th>
                <th className={tableHeaderCellClasses()}>Updated</th>
                <th className={tableHeaderCellClasses('w-10')}>
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredEffects.length === 0 ? (
                <EmptyRow colSpan={7} hasFilters={Boolean(normalisedQuery || activeFilterCount)} />
              ) : (
                filteredEffects.map((effect) => {
                  const href = `/admin/effects/${effect.id}`;
                  return (
                    <tr
                      key={effect.id}
                      onClick={() => open(href)}
                      className={tableRowClasses(
                        'group cursor-pointer hover:bg-[color:var(--color-bg-muted)]',
                      )}
                    >
                      <td className={tableCellClasses()}>
                        <div className="flex items-center gap-3">
                          <EffectPreviewIcon preview={effect.preview} />
                          <div className="min-w-0">
                            <Link
                              href={href}
                              onClick={(event) => event.stopPropagation()}
                              className="block max-w-xs truncate font-medium text-[color:var(--color-content-emphasis)] hover:underline focus:outline-none focus-visible:underline"
                            >
                              {effect.name}
                            </Link>
                            <div className="mt-0.5 max-w-md truncate text-xs text-[color:var(--color-content-subtle)]">
                              {effect.description ?? effect.slug}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className={tableCellClasses()}>
                        <Badge tone="violet" solid icon={Sparkles}>
                          {formatEffectFamily(effect.family)}
                        </Badge>
                      </td>
                      <td className={tableCellClasses()}>
                        <span className="font-mono text-xs whitespace-nowrap text-[color:var(--color-content-subtle)]">
                          {effect.patternKey}
                        </span>
                      </td>
                      <td className={tableCellClasses()}>
                        <Badge tone="neutral">{effect.source}</Badge>
                      </td>
                      <td
                        className={tableCellClasses(
                          'text-right font-mono text-xs text-[color:var(--color-content-subtle)] tabular-nums',
                        )}
                      >
                        {effect.variantCount}
                      </td>
                      <td
                        className={tableCellClasses(
                          'font-mono text-xs text-[color:var(--color-content-subtle)] tabular-nums',
                        )}
                      >
                        {formatStableDateTime(effect.updatedAt)}
                      </td>
                      <td className={tableCellClasses('text-right')}>
                        <ChevronRight
                          size={16}
                          className="text-[color:var(--color-content-subtle)] transition-transform group-hover:translate-x-0.5 group-hover:text-[color:var(--color-content-emphasis)]"
                          aria-hidden
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        ) : (
          <table className={tableClasses('min-w-[860px]')}>
            <thead className={tableHeadClasses()}>
              <tr>
                <th className={tableHeaderCellClasses()}>Default</th>
                <th className={tableHeaderCellClasses()}>Kind</th>
                <th className={tableHeaderCellClasses('text-right')}>Linked effects</th>
                <th className={tableHeaderCellClasses('text-right')}>Linked fireworks</th>
                <th className={tableHeaderCellClasses()}>Updated</th>
                <th className={tableHeaderCellClasses('w-10')}>
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredDefaults.length === 0 ? (
                <EmptyRow colSpan={6} hasFilters={Boolean(normalisedQuery || activeFilterCount)} />
              ) : (
                filteredDefaults.map((item) => {
                  const href = `/admin/effects/defaults/${item.id}`;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => open(href)}
                      className={tableRowClasses(
                        'group cursor-pointer hover:bg-[color:var(--color-bg-muted)]',
                      )}
                    >
                      <td className={tableCellClasses()}>
                        <Link
                          href={href}
                          onClick={(event) => event.stopPropagation()}
                          className="block max-w-xs truncate font-medium text-[color:var(--color-content-emphasis)] hover:underline focus:outline-none focus-visible:underline"
                        >
                          {item.name}
                        </Link>
                        <div className="mt-0.5 max-w-md truncate text-xs text-[color:var(--color-content-subtle)]">
                          {item.description ?? item.slug}
                        </div>
                      </td>
                      <td className={tableCellClasses()}>
                        <Badge tone={styleDefaultBadgeTone(item.kind)} solid>
                          {styleDefaultKindLabel(item.kind)}
                        </Badge>
                      </td>
                      <td
                        className={tableCellClasses(
                          'text-right font-mono text-xs text-[color:var(--color-content-subtle)] tabular-nums',
                        )}
                      >
                        {item.linkedEffectCount}
                      </td>
                      <td
                        className={tableCellClasses(
                          'text-right font-mono text-xs text-[color:var(--color-content-subtle)] tabular-nums',
                        )}
                      >
                        {item.linkedFireworkCount}
                      </td>
                      <td
                        className={tableCellClasses(
                          'font-mono text-xs text-[color:var(--color-content-subtle)] tabular-nums',
                        )}
                      >
                        {formatStableDateTime(item.updatedAt)}
                      </td>
                      <td className={tableCellClasses('text-right')}>
                        <ChevronRight
                          size={16}
                          className="text-[color:var(--color-content-subtle)] transition-transform group-hover:translate-x-0.5 group-hover:text-[color:var(--color-content-emphasis)]"
                          aria-hidden
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </DataTableShell>
    </div>
  );
}

function EmptyRow({ colSpan, hasFilters }: { colSpan: number; hasFilters: boolean }) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-muted-foreground px-4 py-16 text-center text-sm">
        {hasFilters ? 'No matches for your search and filters.' : 'There is nothing here yet.'}
      </td>
    </tr>
  );
}
