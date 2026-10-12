/** Quick effect shortcuts and active-filter chips; each chip is a shareable catalogue URL. */

/** The rest of the effects live in the Filters menu. */
const QUICK_EFFECT_COUNT = 6;

import Link from 'next/link';
import { X } from 'lucide-react';
import {
  catalogueHref,
  colourFamilyLabel,
  type CatalogueFacet,
  type CatalogueFilters,
  type CatalogueSearchParams,
} from '@/lib/catalogue-browse';
import { cn } from '@/lib/utils';

const chipClasses =
  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/45';

function chipStateClasses(active: boolean) {
  return active
    ? 'border-foreground bg-foreground text-background'
    : 'border-border bg-card text-muted-foreground hover:border-border-emphasis hover:text-foreground';
}

export function EffectChips({
  params,
  selected,
  effects,
}: {
  params: CatalogueSearchParams;
  selected: string;
  effects: CatalogueFacet[];
}) {
  const quick = effects.slice(0, QUICK_EFFECT_COUNT);
  const selectedEffect = effects.find((effect) => effect.value === selected);
  if (selectedEffect && !quick.includes(selectedEffect)) quick.push(selectedEffect);
  if (quick.length === 0) return null;
  return (
    <nav aria-label="Popular effects" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      <Link
        href={catalogueHref(params, { effect: null })}
        scroll={false}
        aria-current={selected === '' ? 'true' : undefined}
        className={cn(chipClasses, chipStateClasses(selected === ''))}
      >
        All effects
      </Link>
      {quick.map((effect) => {
        const active = effect.value === selected;
        return (
          <Link
            key={effect.value}
            href={catalogueHref(params, { effect: active ? null : effect.value })}
            scroll={false}
            aria-current={active ? 'true' : undefined}
            className={cn(chipClasses, chipStateClasses(active))}
          >
            {effect.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Result count plus removable chips for every active filter. */
export function ActiveFilterSummary({
  params,
  filters,
  effects,
  resultCount,
  totalCount,
}: {
  params: CatalogueSearchParams;
  filters: CatalogueFilters;
  effects: CatalogueFacet[];
  resultCount: number;
  totalCount: number;
}) {
  const active: Array<{ key: keyof CatalogueSearchParams; label: string }> = [];
  if (filters.query) active.push({ key: 'q', label: `"${filters.query}"` });
  if (filters.effect)
    active.push({
      key: 'effect',
      label: effects.find((effect) => effect.value === filters.effect)?.label ?? filters.effect,
    });
  if (filters.colour) active.push({ key: 'colour', label: colourFamilyLabel(filters.colour) });
  if (filters.caliber) active.push({ key: 'caliber', label: filters.caliber });
  if (filters.kind)
    active.push({
      key: 'kind',
      label: filters.kind === 'multishot' ? 'Multi-shot' : 'Single shot',
    });
  if (filters.priceMaxCents != null)
    active.push({ key: 'price_max', label: `Up to $${params.price_max}` });

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <p className="text-muted-foreground" aria-live="polite">
        <span className="text-foreground font-medium tabular-nums">{resultCount}</span>
        {resultCount === totalCount ? ' fireworks' : ` of ${totalCount} fireworks`}
      </p>
      {active.map((filter) => (
        <Link
          key={filter.key}
          href={catalogueHref(params, { [filter.key]: null })}
          scroll={false}
          className={cn(chipClasses, 'h-7', chipStateClasses(false))}
          aria-label={`Remove filter ${filter.label}`}
        >
          {filter.label}
          <X size={12} aria-hidden />
        </Link>
      ))}
      {active.length > 1 ? (
        <Link
          href={catalogueHref({ sort: params.sort }, {})}
          scroll={false}
          className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-4"
        >
          Clear all
        </Link>
      ) : null}
    </div>
  );
}
