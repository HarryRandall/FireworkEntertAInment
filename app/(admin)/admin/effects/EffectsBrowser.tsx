'use client';

/** URL-backed browser for base effects and renderer style defaults. */

import { useMemo, useState } from 'react';
import { ListFilter, Plus, Search } from 'lucide-react';
import { createCustomStarEffect } from '@/app/actions/admin-effects';
import { createStyleDefaultFromKind } from '@/app/actions/admin-style-defaults';
import { FireworkBrowseCard } from '@/components/catalogue/FireworkBrowseCard';
import { FireworkBrowsePreviewProvider } from '@/components/catalogue/FireworkBrowsePreviewContext';
import { Badge } from '@/components/design-system/Badge';
import { Button } from '@/components/design-system/Button';
import { EmptyNotice } from '@/components/design-system/Feedback';
import { Input } from '@/components/design-system/Input';
import { SelectField } from '@/components/design-system/SelectField';
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
  ADMIN_EFFECTS_BASE_VIEW,
  adminEffectsViewDescription,
  adminEffectsViewLabel,
  type AdminEffectsView,
} from '@/lib/admin-effects-navigation';
import type { AdminEffectSummary, AdminStyleDefaultSummary } from '@/lib/admin.types';
import {
  FIREWORK_STYLE_DEFAULT_KINDS,
  styleDefaultKindLabel,
  type FireworkStyleDefaultKind,
} from '@/lib/fireworks/style-defaults';
import { fireworkPreviewImageUrl, withFireworkPreviewRevision } from '@/lib/firework-preview-image';
import { formatStableDateTime } from '@/lib/show-domain';

type Props = {
  effects: AdminEffectSummary[];
  styleDefaults: AdminStyleDefaultSummary[];
  initialView: AdminEffectsView;
};

const ALL = '__all';

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
    case 'geometry':
      return 'neutral' as const;
  }
}

function matches(query: string, parts: (string | null | undefined)[]) {
  if (!query) return true;
  return parts.filter(Boolean).join(' ').toLowerCase().includes(query);
}

function styleDefaultPreviewUrl(item: AdminStyleDefaultSummary): string {
  return `/api/admin/firework-previews/style-default/${item.id}?revision=${encodeURIComponent(item.updatedAt)}`;
}

type Option = { value: string; label: string };

function FilterPopover({
  activeCount,
  onReset,
  options,
  value,
  onChange,
}: {
  activeCount: number;
  onReset: () => void;
  options: Option[];
  value: string | null;
  onChange: (value: string | null) => void;
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
        <label className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs font-medium">Source</span>
          <SelectField
            value={value ?? ALL}
            ariaLabel="Source"
            onChange={(next) => onChange(next === ALL ? null : next)}
            options={[{ value: ALL, label: 'All sources' }, ...options]}
          />
        </label>
      </PopoverContent>
    </Popover>
  );
}

function CreateEffectAction() {
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
          <DialogDescription>The effect opens in the editor so you can shape it.</DialogDescription>
        </DialogHeader>
        <form action={createCustomStarEffect} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-xs font-medium">Name (optional)</span>
            <Input name="name" placeholder="Custom Star" aria-label="Effect name" />
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

function StyleDefaultCreateAction({ initialKind }: { initialKind: FireworkStyleDefaultKind }) {
  const [kind, setKind] = useState<FireworkStyleDefaultKind>(initialKind);

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

export function EffectsBrowser({ effects, styleDefaults, initialView }: Props) {
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const normalisedQuery = query.trim().toLowerCase();
  const effectsActive = initialView === ADMIN_EFFECTS_BASE_VIEW;
  const activeKind = effectsActive ? null : initialView;

  const sourceOptions = useMemo<Option[]>(() => {
    const values = Array.from(new Set(effects.map((effect) => effect.source)));
    return values
      .map((value) => ({ value, label: value }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [effects]);

  const defaultsForView = useMemo(
    () =>
      activeKind === null
        ? []
        : styleDefaults.filter((styleDefault) => styleDefault.kind === activeKind),
    [activeKind, styleDefaults],
  );

  const filteredEffects = useMemo(
    () =>
      effects.filter(
        (effect) =>
          matches(normalisedQuery, [
            effect.name,
            effect.slug,
            effect.description,
            effect.patternKey,
            effect.source,
          ]) &&
          (!sourceFilter || effect.source === sourceFilter),
      ),
    [effects, normalisedQuery, sourceFilter],
  );

  const filteredDefaults = useMemo(
    () =>
      defaultsForView.filter((item) =>
        matches(normalisedQuery, [item.name, item.slug, item.description]),
      ),
    [defaultsForView, normalisedQuery],
  );

  const posterBackfillTargets = useMemo(
    () =>
      effectsActive
        ? filteredEffects
            .filter((effect) => !effect.previewImagePath)
            .map((effect) => ({
              id: `effect-${effect.id}`,
              previewUrl: withFireworkPreviewRevision(
                `/api/admin/firework-previews/effect/${effect.id}`,
                effect.previewImageRevision,
              ),
            }))
        : filteredDefaults.map((item) => ({
            id: `style-default-${item.id}`,
            previewUrl: styleDefaultPreviewUrl(item),
            persist: false,
            displayPoster: true,
          })),
    [effectsActive, filteredDefaults, filteredEffects],
  );

  const visibleCount = effectsActive ? filteredEffects.length : filteredDefaults.length;
  const totalCount = effectsActive ? effects.length : defaultsForView.length;
  const itemLabel = effectsActive ? 'base effect' : 'style default';
  const hasFilters = Boolean(normalisedQuery || sourceFilter);

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Effects
          </p>
          <h1 className="text-foreground mt-1 text-2xl font-semibold tracking-tight">
            {adminEffectsViewLabel(initialView)}
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            {adminEffectsViewDescription(initialView)}
          </p>
        </div>
        <div className="shrink-0">
          {activeKind === null ? (
            <CreateEffectAction />
          ) : (
            <StyleDefaultCreateAction initialKind={activeKind} />
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={effectsActive ? 'Search base effects…' : 'Search style defaults…'}
            iconLeft={<Search size={16} />}
            aria-label="Search"
          />
        </div>
        {effectsActive ? (
          <FilterPopover
            activeCount={sourceFilter ? 1 : 0}
            onReset={() => setSourceFilter(null)}
            options={sourceOptions}
            value={sourceFilter}
            onChange={setSourceFilter}
          />
        ) : null}
      </div>

      {visibleCount === 0 ? (
        <EmptyNotice>
          {hasFilters
            ? 'No items match your search and filters.'
            : `No ${itemLabel}s have been created in this category yet.`}
        </EmptyNotice>
      ) : (
        <FireworkBrowsePreviewProvider posterBackfillTargets={posterBackfillTargets}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {effectsActive
              ? filteredEffects.map((effect) => (
                  <FireworkBrowseCard
                    key={effect.id}
                    previewId={`effect-${effect.id}`}
                    previewUrl={withFireworkPreviewRevision(
                      `/api/admin/firework-previews/effect/${effect.id}`,
                      effect.previewImageRevision,
                    )}
                    persistedPosterUrl={fireworkPreviewImageUrl(effect.previewImagePath)}
                    persistPoster
                    label={effect.name}
                    href={`/admin/effects/${effect.id}`}
                  >
                    <div className="p-4">
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <h2 className="text-foreground line-clamp-2 min-w-0 text-sm leading-5 font-semibold">
                          {effect.name}
                        </h2>
                        <Badge tone="neutral" className="max-w-32 shrink-0 truncate">
                          {effect.source}
                        </Badge>
                      </div>
                      <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                        <span className="truncate font-mono">{effect.patternKey}</span>
                        <span aria-hidden>·</span>
                        <span className="tabular-nums">
                          {effect.variantCount.toLocaleString()}{' '}
                          {effect.variantCount === 1 ? 'variant' : 'variants'}
                        </span>
                      </div>
                    </div>
                  </FireworkBrowseCard>
                ))
              : filteredDefaults.map((item) => (
                  <FireworkBrowseCard
                    key={item.id}
                    previewId={`style-default-${item.id}`}
                    previewUrl={styleDefaultPreviewUrl(item)}
                    label={item.name}
                    href={`/admin/effects/defaults/${item.id}?view=${item.kind}`}
                  >
                    <div className="p-4">
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <h2 className="text-foreground line-clamp-2 min-w-0 text-sm leading-5 font-semibold">
                          {item.name}
                        </h2>
                        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                          <Badge tone={styleDefaultBadgeTone(item.kind)} solid>
                            {styleDefaultKindLabel(item.kind)}
                          </Badge>
                          {item.isArchived ? <Badge tone="neutral">Archived</Badge> : null}
                        </div>
                      </div>
                      <p className="text-muted-foreground mt-2 line-clamp-2 min-h-10 text-xs leading-5">
                        {item.description ?? item.slug}
                      </p>
                      <p className="text-muted-foreground mt-3 text-xs">
                        Updated{' '}
                        <time dateTime={item.updatedAt} className="font-mono tabular-nums">
                          {formatStableDateTime(item.updatedAt)}
                        </time>
                      </p>
                    </div>
                  </FireworkBrowseCard>
                ))}
          </div>
        </FireworkBrowsePreviewProvider>
      )}

      <BrowserCount visibleCount={visibleCount} totalCount={totalCount} itemLabel={itemLabel} />
    </div>
  );
}

function BrowserCount({
  visibleCount,
  totalCount,
  itemLabel,
}: {
  visibleCount: number;
  totalCount: number;
  itemLabel: string;
}) {
  return (
    <p className="text-muted-foreground text-sm">
      Viewing <span className="text-foreground font-medium tabular-nums">{visibleCount}</span> of{' '}
      <span className="tabular-nums">{totalCount}</span>{' '}
      {totalCount === 1 ? itemLabel : `${itemLabel}s`}
    </p>
  );
}
