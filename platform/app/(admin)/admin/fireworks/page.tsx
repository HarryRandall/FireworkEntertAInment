/** Admin fireworks page: every atomic firework (effect + colours + overrides). */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { ArrowRight } from 'lucide-react';
import { EffectPreviewIcon } from '@/app/components/admin/EffectPreviewIcon';
import { FilterSkeleton, TableSkeleton } from '@/app/components/app/RouteSkeletons';
import { Badge } from '@/app/components/ui/Badge';
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
import { listAdminFireworks, listEffectOptions } from '@/lib/admin.server';
import { formatDuration } from '@/lib/show-domain';
import { NewFireworkButton } from './NewFireworkButton';

type PageProps = {
  searchParams: Promise<{ q?: string; effect?: string; page?: string }>;
};

type FireworksSearchParams = Awaited<PageProps['searchParams']>;

function Swatch({ color }: { color: string | null }) {
  if (!color) return <span className="text-[color:var(--color-content-subtle)]">—</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="inline-block h-3.5 w-3.5 rounded-full border border-[color:var(--color-border-subtle)]"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className="font-mono text-xs text-[color:var(--color-content-subtle)]">{color}</span>
    </span>
  );
}

export default async function AdminFireworksPage({ searchParams }: PageProps) {
  const params = await searchParams;
  if (params.effect) {
    const cleaned = new URLSearchParams();
    if (params.q) cleaned.set('q', params.q);
    if (params.page) cleaned.set('page', params.page);
    const query = cleaned.toString();
    redirect(query ? `/admin/fireworks?${query}` : '/admin/fireworks');
  }

  const effects = await listEffectOptions();
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-8">
      <Suspense
        fallback={
          <>
            <FilterSkeleton
              searchPlaceholder="Search firework, effect, colour..."
              actionLabel="New firework"
            />
            <div className="min-h-0 flex-1 overflow-hidden">
              <TableSkeleton
                rows={TABLE_PAGE_SIZE}
                headers={[
                  'Preview',
                  'Firework',
                  'Base effect',
                  'Colour',
                  'Calibre',
                  'Duration',
                  'Open',
                ]}
                tableClassName="min-w-[960px]"
              />
            </div>
          </>
        }
      >
        <FireworksData params={params} effects={effects} />
      </Suspense>
    </div>
  );
}

async function FireworksData({
  params,
  effects,
}: {
  params: FireworksSearchParams;
  effects: Awaited<ReturnType<typeof listEffectOptions>>;
}) {
  const query = (params.q ?? '').trim().toLowerCase();
  const requestedPage = Number(params.page ?? '1');
  const fireworks = await listAdminFireworks();

  const filtered = fireworks.filter((firework) => {
    const text = [
      firework.name,
      firework.slug,
      firework.effectName,
      firework.caliber,
      firework.primaryColor,
      ...firework.colorPalette,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return !query || text.includes(query);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / TABLE_PAGE_SIZE));
  const currentPage = Number.isFinite(requestedPage)
    ? Math.min(Math.max(1, requestedPage), totalPages)
    : 1;
  const pageStart = (currentPage - 1) * TABLE_PAGE_SIZE;
  const paginated = filtered.slice(pageStart, pageStart + TABLE_PAGE_SIZE);

  return (
    <>
      <FilterBar
        searchPlaceholder="Search firework, effect, colour…"
        action={<NewFireworkButton effects={effects} />}
      />

      <DataTableShell
        viewport
        footer={
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            searchParams={{ q: params.q, page: params.page }}
            visibleItems={paginated.length}
            totalItems={filtered.length}
            itemLabel="firework"
          />
        }
      >
        <table className={tableClasses('min-w-[960px]')}>
          <thead className={tableHeadClasses()}>
            <tr>
              <th className={tableHeaderCellClasses()}>Preview</th>
              <th className={tableHeaderCellClasses()}>Firework</th>
              <th className={tableHeaderCellClasses()}>Base effect</th>
              <th className={tableHeaderCellClasses()}>Colour</th>
              <th className={tableHeaderCellClasses()}>Calibre</th>
              <th className={tableHeaderCellClasses()}>Duration</th>
              <th className={tableHeaderCellClasses('text-right')}>Open</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((firework) => (
              <tr key={firework.id} className={tableRowClasses()}>
                <td className={tableCellClasses()}>
                  <EffectPreviewIcon preview={firework.preview} />
                </td>
                <td className={tableCellClasses()}>
                  <div className="line-clamp-2 max-w-xs font-medium text-[color:var(--color-content-emphasis)]">
                    {firework.name}
                  </div>
                </td>
                <td className={tableCellClasses()}>
                  {firework.effectName ? (
                    <Badge tone="neutral" className="whitespace-nowrap">
                      {firework.effectName}
                    </Badge>
                  ) : (
                    '—'
                  )}
                </td>
                <td className={tableCellClasses()}>
                  <Swatch color={firework.primaryColor ?? firework.colorPalette[0] ?? null} />
                </td>
                <td className={tableCellClasses('text-[color:var(--color-content-subtle)]')}>
                  {firework.caliber ?? '—'}
                </td>
                <td
                  className={tableCellClasses(
                    'font-mono text-xs text-[color:var(--color-content-subtle)] tabular-nums',
                  )}
                >
                  {formatDuration(firework.durationSeconds)}
                </td>
                <td className={tableCellClasses('text-right')}>
                  <Link
                    href={`/admin/fireworks/${firework.id}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[color:var(--color-content-subtle)] transition-colors hover:bg-[color:var(--color-bg-muted)] hover:text-[color:var(--color-content-emphasis)] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-content-emphasis)]"
                    aria-label={`Open ${firework.name}`}
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
