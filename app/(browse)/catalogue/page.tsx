/** Read-only firework catalogue page for the app sidebar. */

import { Suspense } from 'react';
import { Clock3, Layers3 } from 'lucide-react';
import { FireworkBrowseCard } from '@/components/catalogue/FireworkBrowseCard';
import { FireworkBrowsePreviewProvider } from '@/components/catalogue/FireworkBrowsePreviewContext';
import { EmptyNotice } from '@/components/design-system/Feedback';
import { TablePagination } from '@/components/design-system/TablePagination';
import { fireworkPreviewImageUrl, withFireworkPreviewRevision } from '@/lib/firework-preview-image';
import { listFireworkProducts } from '@/lib/shows.server';
import {
  formatDuration,
  formatManufacturerLabel,
  matchesManufacturerFilter,
} from '@/lib/show-domain';
import { CATALOGUE_PAGE_SIZE, CatalogueSkeleton } from './CatalogueSkeleton';
import { CatalogueToolbar } from './CatalogueToolbar';

type PageProps = {
  searchParams?: Promise<{
    kind?: string;
    manufacturer?: string;
    duration_min?: string;
    duration_max?: string;
    page?: string;
    q?: string;
  }>;
};

type CatalogueProduct = Awaited<ReturnType<typeof listFireworkProducts>>[number];

function matchesProduct(
  product: CatalogueProduct,
  query: string,
  kind: string,
  manufacturer: string,
  durationMin: number | null,
  durationMax: number | null,
) {
  const shotCount = product.shotCount ?? 1;
  if (kind === 'single' && shotCount > 1) return false;
  if (kind === 'multishot' && shotCount <= 1) return false;
  if (!matchesManufacturerFilter(product.manufacturer, manufacturer)) return false;
  const duration = product.durationSeconds;
  if (durationMin != null && (duration == null || duration < durationMin)) return false;
  if (durationMax != null && (duration == null || duration > durationMax)) return false;

  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    product.name,
    product.description,
    product.slug,
    product.caliber,
    product.baseEffect?.name,
  ]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(q));
}

function parsePage(value: string | undefined) {
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function CataloguePage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const query = params.q ?? '';
  const kind = params.kind ?? '';
  const manufacturer = params.manufacturer ?? '';
  const durationMin = params.duration_min ?? '';
  const durationMax = params.duration_max ?? '';

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
      <header>
        <h1 className="text-foreground text-2xl font-bold tracking-tight">Firework catalogue</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
          Browse the products and effects available for ShowCrafter timelines.
        </p>
      </header>
      <CatalogueToolbar
        kind={kind}
        manufacturer={manufacturer}
        durationMin={durationMin}
        durationMax={durationMax}
        query={query}
      />

      <Suspense fallback={<CatalogueSkeleton />}>
        <CatalogueList
          kind={kind}
          manufacturer={manufacturer}
          durationMin={durationMin}
          durationMax={durationMax}
          page={params.page}
          query={query}
        />
      </Suspense>
    </div>
  );
}

async function CatalogueList({
  kind,
  manufacturer,
  durationMin,
  durationMax,
  page,
  query,
}: {
  kind: string;
  manufacturer: string;
  durationMin: string;
  durationMax: string;
  page?: string;
  query: string;
}) {
  const parsedDurationMin = durationMin ? Number(durationMin) : null;
  const parsedDurationMax = durationMax ? Number(durationMax) : null;
  const products = (await listFireworkProducts({ lightweight: true })).filter((product) =>
    matchesProduct(product, query, kind, manufacturer, parsedDurationMin, parsedDurationMax),
  );

  if (products.length === 0) {
    return <EmptyNotice>No catalogue products match that search.</EmptyNotice>;
  }

  const totalPages = Math.ceil(products.length / CATALOGUE_PAGE_SIZE);
  const currentPage = Math.min(parsePage(page), totalPages);
  const pageStart = (currentPage - 1) * CATALOGUE_PAGE_SIZE;
  const visibleProducts = products.slice(pageStart, pageStart + CATALOGUE_PAGE_SIZE);

  return (
    <div className="space-y-5">
      <FireworkBrowsePreviewProvider>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visibleProducts.map((product) => (
            <FireworkBrowseCard
              key={product.id}
              previewId={`catalogue-${product.id}`}
              previewUrl={withFireworkPreviewRevision(
                `/api/catalogue/${product.id}/preview`,
                product.previewImageRevision,
              )}
              persistedPosterUrl={fireworkPreviewImageUrl(product.previewImagePath)}
              label={product.name}
            >
              <div className="p-4">
                <h2 className="text-foreground line-clamp-2 text-sm leading-5 font-semibold">
                  {product.name}
                </h2>
                <p className="text-muted-foreground mt-1 truncate font-mono text-xs tabular-nums">
                  {formatManufacturerLabel(product.manufacturer)}
                </p>
                <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                  <span className="inline-flex items-center gap-1.5">
                    <Layers3 size={13} aria-hidden />
                    <span className="tabular-nums">
                      {(product.shotCount ?? 1).toLocaleString()}{' '}
                      {(product.shotCount ?? 1) === 1 ? 'shot' : 'shots'}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 size={13} aria-hidden />
                    <span className="font-mono tabular-nums">
                      {formatDuration(product.durationSeconds)}
                    </span>
                  </span>
                </div>
              </div>
            </FireworkBrowseCard>
          ))}
        </div>
      </FireworkBrowsePreviewProvider>

      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        searchParams={{
          kind: kind || undefined,
          manufacturer: manufacturer || undefined,
          duration_min: durationMin || undefined,
          duration_max: durationMax || undefined,
          q: query || undefined,
        }}
        visibleItems={visibleProducts.length}
        totalItems={products.length}
        itemLabel="product"
      />
    </div>
  );
}
