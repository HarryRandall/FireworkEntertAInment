/** Admin multishots page: compositions of fireworks placed on a timeline. */

import { Suspense } from 'react';
import { Clock3, Layers3 } from 'lucide-react';
import {
  FireworkBrowseCard,
  FireworkBrowseGridSkeleton,
} from '@/components/catalogue/FireworkBrowseCard';
import { FireworkBrowsePreviewProvider } from '@/components/catalogue/FireworkBrowsePreviewContext';
import { FilterSkeleton } from '@/components/shell/RouteSkeletons';
import { EmptyNotice } from '@/components/design-system/Feedback';
import { FilterBar } from '@/components/design-system/FilterBar';
import { TABLE_PAGE_SIZE, TablePagination } from '@/components/design-system/TablePagination';
import { listMultishots } from '@/lib/admin.server';
import { fireworkPreviewImageUrl, withFireworkPreviewRevision } from '@/lib/firework-preview-image';
import { formatDuration } from '@/lib/show-domain';
import { NewMultishotButton } from './NewMultishotButton';

type PageProps = {
  searchParams: Promise<{ q?: string; page?: string }>;
};

type MultishotsSearchParams = Awaited<PageProps['searchParams']>;

export default async function AdminMultishotsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-8">
      <Suspense
        fallback={
          <>
            <FilterSkeleton searchPlaceholder="Search multishot..." actionLabel="New multishot" />
            <FireworkBrowseGridSkeleton count={8} />
          </>
        }
      >
        <MultishotsData params={params} />
      </Suspense>
    </div>
  );
}

async function MultishotsData({ params }: { params: MultishotsSearchParams }) {
  const query = (params.q ?? '').trim().toLowerCase();
  const requestedPage = Number(params.page ?? '1');
  const multishots = await listMultishots();

  const filtered = multishots.filter((multishot) => {
    const text = [multishot.name, multishot.slug].filter(Boolean).join(' ').toLowerCase();
    return !query || text.includes(query);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / TABLE_PAGE_SIZE));
  const currentPage = Number.isFinite(requestedPage)
    ? Math.min(Math.max(1, requestedPage), totalPages)
    : 1;
  const pageStart = (currentPage - 1) * TABLE_PAGE_SIZE;
  const paginated = filtered.slice(pageStart, pageStart + TABLE_PAGE_SIZE);
  const posterBackfillTargets = filtered
    .filter((multishot) => !multishot.previewImagePath)
    .map((multishot) => ({
      id: `multishot-${multishot.id}`,
      previewUrl: withFireworkPreviewRevision(
        `/api/admin/firework-previews/multishot/${multishot.id}`,
        multishot.previewImageRevision,
      ),
    }));

  return (
    <>
      <FilterBar searchPlaceholder="Search multishot…" action={<NewMultishotButton />} />

      <div className="space-y-5">
        {paginated.length === 0 ? (
          <EmptyNotice>
            {query ? 'No multishots match that search.' : 'No multishots have been created yet.'}
          </EmptyNotice>
        ) : (
          <FireworkBrowsePreviewProvider posterBackfillTargets={posterBackfillTargets}>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {paginated.map((multishot) => (
                <FireworkBrowseCard
                  key={multishot.id}
                  previewId={`multishot-${multishot.id}`}
                  previewUrl={withFireworkPreviewRevision(
                    `/api/admin/firework-previews/multishot/${multishot.id}`,
                    multishot.previewImageRevision,
                  )}
                  persistedPosterUrl={fireworkPreviewImageUrl(multishot.previewImagePath)}
                  persistPoster
                  label={multishot.name}
                  href={`/admin/multishots/${multishot.id}`}
                >
                  <div className="p-4">
                    <h2 className="text-foreground line-clamp-2 text-sm leading-5 font-semibold">
                      {multishot.name}
                    </h2>
                    <p className="text-muted-foreground mt-1 truncate font-mono text-xs tabular-nums">
                      {multishot.slug}
                    </p>
                    <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                      <span className="inline-flex items-center gap-1.5">
                        <Layers3 size={13} aria-hidden />
                        <span className="tabular-nums">
                          {multishot.shotCount.toLocaleString()}{' '}
                          {multishot.shotCount === 1 ? 'shot' : 'shots'}
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 size={13} aria-hidden />
                        <span className="font-mono tabular-nums">
                          {formatDuration(multishot.durationSeconds)}
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
          searchParams={params}
          visibleItems={paginated.length}
          totalItems={filtered.length}
          itemLabel="multishot"
        />
      </div>
    </>
  );
}
