/** Admin effects page listing colourless base firework effects. */

import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';
import { ArrowRight, Plus, Sparkles } from 'lucide-react';
import { EffectPreviewIcon } from '@/app/components/admin/EffectPreviewIcon';
import { createCustomStarEffect } from '@/app/actions/admin-effects';
import { createStyleDefaultFromKind } from '@/app/actions/admin-style-defaults';
import { FilterSkeleton, TableSkeleton } from '@/app/components/app/RouteSkeletons';
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
import { FilterBar } from '@/app/components/ui/FilterBar';
import { TABLE_PAGE_SIZE, TablePagination } from '@/app/components/ui/TablePagination';
import { listAdminEffects, listAdminStyleDefaults } from '@/lib/admin.server';
import {
  FIREWORK_STYLE_DEFAULT_KINDS,
  styleDefaultKindLabel,
  type FireworkStyleDefaultKind,
} from '@/lib/fireworks/style-defaults';
import { formatStableDateTime } from '@/lib/show-domain';
import { cn } from '@/lib/utils';

type PageProps = {
  searchParams: Promise<{
    q?: string;
    family?: string;
    source?: string;
    kind?: string;
    tab?: string;
    page?: string;
  }>;
};

type EffectsSearchParams = Awaited<PageProps['searchParams']>;
type EffectsTab = 'effects' | 'defaults';

function styleDefaultBadgeTone(kind: FireworkStyleDefaultKind) {
  switch (kind) {
    case 'star':
      return 'violet';
    case 'trail':
      return 'sky';
    case 'launch':
      return 'info';
    case 'smoke':
      return 'neutral';
    case 'strobe':
      return 'primary';
    case 'crackle':
      return 'amber-soft';
    case 'split':
      return 'warning';
    case 'sound':
      return 'success';
  }
}

function formatEffectFamily(value: string) {
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function EffectsViewSelector({ activeTab }: { activeTab: EffectsTab }) {
  const options: { value: EffectsTab; label: string; href: string }[] = [
    { value: 'effects', label: 'Effects', href: '/admin/effects' },
    { value: 'defaults', label: 'Style defaults', href: '/admin/effects?tab=defaults' },
  ];

  return (
    <div
      className="border-border bg-background inline-flex h-10 shrink-0 items-center rounded-lg border p-1 shadow-xs"
      role="group"
      aria-label="Effects view"
    >
      {options.map((option) => {
        const selected = activeTab === option.value;
        return (
          <Link
            key={option.value}
            href={option.href}
            aria-current={selected ? 'page' : undefined}
            className={cn(
              'focus-visible:ring-ring/50 inline-flex h-8 items-center rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-3',
              selected
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}

function EffectsFilterToolbar({
  activeTab,
  action,
  children,
}: {
  activeTab: EffectsTab;
  action: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-3 xl:grid-cols-[auto_minmax(0,1fr)_auto] xl:items-start">
      <EffectsViewSelector activeTab={activeTab} />
      <div className="min-w-0">{children}</div>
      <div className="flex min-w-0 justify-end">{action}</div>
    </div>
  );
}

function CreateEffectAction() {
  return (
    <form action={createCustomStarEffect}>
      <Button type="submit" variant="secondary" size="md" className="w-full sm:w-auto">
        <Plus size={16} />
        New custom effect
      </Button>
    </form>
  );
}

function StyleDefaultCreateAction() {
  return (
    <form action={createStyleDefaultFromKind} className="flex w-full items-center gap-2 sm:w-auto">
      <label htmlFor="style-default-kind" className="sr-only">
        Style default kind
      </label>
      <select
        id="style-default-kind"
        name="kind"
        defaultValue="star"
        className="border-border bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-10 min-w-0 flex-1 rounded-md border px-3 text-sm font-medium shadow-xs transition-colors outline-none focus-visible:ring-3 sm:w-40 sm:flex-none"
      >
        {FIREWORK_STYLE_DEFAULT_KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {styleDefaultKindLabel(kind)}
          </option>
        ))}
      </select>
      <Button type="submit" variant="secondary" size="md" className="shrink-0">
        <Plus size={16} />
        Add new
      </Button>
    </form>
  );
}

export default async function AdminEffectsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const activeTab = params.tab === 'defaults' ? 'defaults' : 'effects';
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8">
      <Suspense
        fallback={
          <>
            <FilterSkeleton searchPlaceholder="Search name, slug, description..." />
            <div className="min-h-0 flex-1 overflow-hidden">
              <TableSkeleton
                rows={TABLE_PAGE_SIZE}
                headers={[
                  'Preview',
                  'Effect',
                  'Family',
                  'Pattern',
                  'Source',
                  'Variants',
                  'Updated',
                  'Open',
                ]}
                tableClassName="min-w-[1080px]"
              />
            </div>
          </>
        }
      >
        {activeTab === 'defaults' ? (
          <StyleDefaultsData params={params} />
        ) : (
          <EffectsData params={params} />
        )}
      </Suspense>
    </div>
  );
}

async function EffectsData({ params }: { params: EffectsSearchParams }) {
  const query = (params.q ?? '').trim().toLowerCase();
  const familyFilter = params.family;
  const sourceFilter = params.source;
  const requestedPage = Number(params.page ?? '1');
  const effects = await listAdminEffects();

  const familyOptions = Array.from(new Set(effects.map((effect) => effect.family)))
    .sort()
    .map((value) => ({ value, label: formatEffectFamily(value) }));
  const sourceOptions = Array.from(new Set(effects.map((effect) => effect.source)))
    .sort()
    .map((value) => ({ value, label: value }));

  const filtered = effects.filter((effect) => {
    const text = [
      effect.name,
      effect.slug,
      effect.description,
      effect.family,
      effect.patternKey,
      effect.source,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const matchesQuery = !query || text.includes(query);
    const matchesFamily = !familyFilter || effect.family === familyFilter;
    const matchesSource = !sourceFilter || effect.source === sourceFilter;
    return matchesQuery && matchesFamily && matchesSource;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / TABLE_PAGE_SIZE));
  const currentPage = Number.isFinite(requestedPage)
    ? Math.min(Math.max(1, requestedPage), totalPages)
    : 1;
  const pageStart = (currentPage - 1) * TABLE_PAGE_SIZE;
  const paginated = filtered.slice(pageStart, pageStart + TABLE_PAGE_SIZE);

  return (
    <>
      <EffectsFilterToolbar activeTab="effects" action={<CreateEffectAction />}>
        <FilterBar
          searchPlaceholder="Search name, slug, description…"
          filters={[
            { key: 'family', label: 'Family', type: 'select', options: familyOptions },
            { key: 'source', label: 'Source', type: 'select', options: sourceOptions },
          ]}
        />
      </EffectsFilterToolbar>

      <DataTableShell
        viewport
        footer={
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            searchParams={params}
            visibleItems={paginated.length}
            totalItems={filtered.length}
            itemLabel="effect"
          />
        }
      >
        <table className={tableClasses('min-w-[1080px]')}>
          <thead className={tableHeadClasses()}>
            <tr>
              <th className={tableHeaderCellClasses()}>Preview</th>
              <th className={tableHeaderCellClasses()}>Effect</th>
              <th className={tableHeaderCellClasses()}>Family</th>
              <th className={tableHeaderCellClasses()}>Pattern</th>
              <th className={tableHeaderCellClasses()}>Source</th>
              <th className={tableHeaderCellClasses()}>Variants</th>
              <th className={tableHeaderCellClasses()}>Updated</th>
              <th className={tableHeaderCellClasses('text-right')}>Open</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((effect) => (
              <tr key={effect.id} className={tableRowClasses()}>
                <td className={tableCellClasses()}>
                  <EffectPreviewIcon preview={effect.preview} />
                </td>
                <td className={tableCellClasses()}>
                  <div className="max-w-xs truncate font-medium text-[color:var(--color-content-emphasis)]">
                    {effect.name}
                  </div>
                  <div className="mt-1 max-w-md truncate text-xs text-[color:var(--color-content-subtle)]">
                    {effect.description ?? effect.slug}
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
                    'font-mono text-xs text-[color:var(--color-content-subtle)] tabular-nums',
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
                  <Link
                    href={`/admin/effects/${effect.id}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[color:var(--color-content-subtle)] transition-colors hover:bg-[color:var(--color-bg-muted)] hover:text-[color:var(--color-content-emphasis)] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-content-emphasis)]"
                    aria-label={`Open ${effect.name}`}
                  >
                    <ArrowRight size={16} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>
    </>
  );
}

async function StyleDefaultsData({ params }: { params: EffectsSearchParams }) {
  const query = (params.q ?? '').trim().toLowerCase();
  const kindFilter = params.kind;
  const requestedPage = Number(params.page ?? '1');
  const styleDefaults = await listAdminStyleDefaults();

  const filtered = styleDefaults.filter((styleDefault) => {
    const text = [styleDefault.name, styleDefault.slug, styleDefault.description, styleDefault.kind]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const matchesQuery = !query || text.includes(query);
    const matchesKind = !kindFilter || styleDefault.kind === kindFilter;
    return matchesQuery && matchesKind;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / TABLE_PAGE_SIZE));
  const currentPage = Number.isFinite(requestedPage)
    ? Math.min(Math.max(1, requestedPage), totalPages)
    : 1;
  const pageStart = (currentPage - 1) * TABLE_PAGE_SIZE;
  const paginated = filtered.slice(pageStart, pageStart + TABLE_PAGE_SIZE);

  return (
    <>
      <EffectsFilterToolbar activeTab="defaults" action={<StyleDefaultCreateAction />}>
        <FilterBar
          searchPlaceholder="Search style defaults..."
          filters={[
            {
              key: 'kind',
              label: 'Kind',
              type: 'select',
              options: FIREWORK_STYLE_DEFAULT_KINDS.map((kind) => ({
                value: kind,
                label: styleDefaultKindLabel(kind),
              })),
            },
          ]}
        />
      </EffectsFilterToolbar>

      <DataTableShell
        viewport
        footer={
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            searchParams={params}
            visibleItems={paginated.length}
            totalItems={filtered.length}
            itemLabel="style default"
          />
        }
      >
        <table className={tableClasses('min-w-[900px]')}>
          <thead className={tableHeadClasses()}>
            <tr>
              <th className={tableHeaderCellClasses()}>Default</th>
              <th className={tableHeaderCellClasses()}>Kind</th>
              <th className={tableHeaderCellClasses()}>Linked effects</th>
              <th className={tableHeaderCellClasses()}>Linked fireworks</th>
              <th className={tableHeaderCellClasses()}>Updated</th>
              <th className={tableHeaderCellClasses('text-right')}>Open</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((styleDefault) => (
              <tr key={styleDefault.id} className={tableRowClasses()}>
                <td className={tableCellClasses()}>
                  <div className="max-w-xs truncate font-medium text-[color:var(--color-content-emphasis)]">
                    {styleDefault.name}
                  </div>
                  <div className="mt-1 max-w-md truncate text-xs text-[color:var(--color-content-subtle)]">
                    {styleDefault.description ?? styleDefault.slug}
                  </div>
                </td>
                <td className={tableCellClasses()}>
                  <Badge tone={styleDefaultBadgeTone(styleDefault.kind)} solid>
                    {styleDefaultKindLabel(styleDefault.kind)}
                  </Badge>
                </td>
                <td
                  className={tableCellClasses(
                    'font-mono text-xs text-[color:var(--color-content-subtle)] tabular-nums',
                  )}
                >
                  {styleDefault.linkedEffectCount}
                </td>
                <td
                  className={tableCellClasses(
                    'font-mono text-xs text-[color:var(--color-content-subtle)] tabular-nums',
                  )}
                >
                  {styleDefault.linkedFireworkCount}
                </td>
                <td
                  className={tableCellClasses(
                    'font-mono text-xs text-[color:var(--color-content-subtle)] tabular-nums',
                  )}
                >
                  {formatStableDateTime(styleDefault.updatedAt)}
                </td>
                <td className={tableCellClasses('text-right')}>
                  <Link
                    href={`/admin/effects/defaults/${styleDefault.id}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[color:var(--color-content-subtle)] transition-colors hover:bg-[color:var(--color-bg-muted)] hover:text-[color:var(--color-content-emphasis)] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-content-emphasis)]"
                    aria-label={`Open ${styleDefault.name}`}
                  >
                    <ArrowRight size={16} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>
    </>
  );
}
