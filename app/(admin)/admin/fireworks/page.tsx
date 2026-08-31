/** Admin fireworks page: every atomic firework (effect + colours + overrides). */

import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Clock3, Sparkles } from 'lucide-react';
import {
  FireworkBrowseCard,
  FireworkBrowseGridSkeleton,
} from '@/components/catalogue/FireworkBrowseCard';
import { FireworkBrowsePreviewProvider } from '@/components/catalogue/FireworkBrowsePreviewContext';
import { FilterSkeleton } from '@/components/shell/RouteSkeletons';
import { EmptyNotice } from '@/components/design-system/Feedback';
import { FilterBar } from '@/components/design-system/FilterBar';
import { TABLE_PAGE_SIZE, TablePagination } from '@/components/design-system/TablePagination';
import { listAdminFireworks, listEffectOptions } from '@/lib/admin.server';
import { fireworkPreviewImageUrl, withFireworkPreviewRevision } from '@/lib/firework-preview-image';
import { formatDuration } from '@/lib/show-domain';
import { NewFireworkButton } from './NewFireworkButton';

type PageProps = {
  searchParams: Promise<{ q?: string; effect?: string; page?: string }>;
};

type FireworksSearchParams = Awaited<PageProps['searchParams']>;

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
              searchPlaceholder="Search fireworks or effects..."
              actionLabel="New firework"
            />
            <FireworkBrowseGridSkeleton count={8} />
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
  const posterBackfillTargets = filtered
    .filter((firework) => !firework.previewImagePath)
    .map((firework) => ({
      id: `firework-${firework.id}`,
      previewUrl: withFireworkPreviewRevision(
        `/api/admin/firework-previews/firework/${firework.id}`,
        firework.previewImageRevision,
      ),
    }));

  return (
    <>
      <FilterBar
        searchPlaceholder="Search fireworks or effects…"
        action={<NewFireworkButton effects={effects} />}
      />

      <div className="space-y-5">
        {paginated.length === 0 ? (
          <EmptyNotice>
            {query ? 'No fireworks match that search.' : 'No fireworks have been created yet.'}
          </EmptyNotice>
        ) : (
          <FireworkBrowsePreviewProvider posterBackfillTargets={posterBackfillTargets}>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {paginated.map((firework) => (
                <FireworkBrowseCard
                  key={firework.id}
                  previewId={`firework-${firework.id}`}
                  previewUrl={withFireworkPreviewRevision(
                    `/api/admin/firework-previews/firework/${firework.id}`,
                    firework.previewImageRevision,
                  )}
                  persistedPosterUrl={fireworkPreviewImageUrl(firework.previewImagePath)}
                  persistPoster
                  label={firework.name}
                  href={`/admin/fireworks/${firework.id}`}
                >
                  <div className="p-4">
                    <h2 className="text-foreground line-clamp-2 text-sm leading-5 font-semibold">
                      {firework.name}
                    </h2>
                    <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <Sparkles size={13} className="shrink-0" aria-hidden />
                        <span className="truncate">{firework.effectName ?? 'No base effect'}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 size={13} aria-hidden />
                        <span className="font-mono tabular-nums">
                          {formatDuration(firework.durationSeconds)}
                        </span>
                      </span>
                    </div>
                  </div>
                </FireworkBrowseCard>
              ))}
            </div>
          </FireworkBrowsePreviewProvider>
        )}

        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          searchParams={{ q: params.q, page: params.page }}
          visibleItems={paginated.length}
          totalItems={filtered.length}
          itemLabel="firework"
        />
      </div>
    </>
  );
}
