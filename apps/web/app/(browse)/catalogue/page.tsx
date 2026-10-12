/** Public firework catalogue: browse, filter and preview every listed product. */

import { Suspense } from 'react';
import { listFireworkProducts } from '@/lib/shows/queries.server';
import {
  catalogueFacets,
  catalogueHref,
  matchesCatalogueFilters,
  parseCatalogueFilters,
  sortCatalogueProducts,
  type CatalogueFilters,
  type CatalogueSearchParams,
} from '@/lib/catalogue-browse';
import { FireworkBrowsePreviewProvider } from '@/ui/catalogue/FireworkBrowsePreviewContext';
import { EmptyNotice } from '@/ui/patterns/Feedback';
import { TablePagination } from '@/ui/patterns/TablePagination';
import {
  CATALOGUE_PAGE_SIZE,
  CatalogueBrowserSkeleton,
} from '@/app/(browse)/catalogue/_components/CatalogueSkeleton';
import { CatalogueToolbar } from '@/app/(browse)/catalogue/_components/CatalogueToolbar';
import { CatalogueProductCard } from '@/app/(browse)/catalogue/_components/CatalogueProductCard';
import {
  ActiveFilterSummary,
  ColourChips,
  EffectChips,
} from '@/app/(browse)/catalogue/_components/CatalogueFacetChips';

type PageProps = {
  searchParams?: Promise<CatalogueSearchParams>;
};

function parsePage(value: string | undefined) {
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function CataloguePage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const filters = parseCatalogueFilters(params);

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
      <header>
        <h1 className="text-foreground text-2xl font-bold tracking-tight">Firework catalogue</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
          Hover any firework to watch it fire, or open it for the full specification, colours and
          shot sequence.
        </p>
      </header>

      <Suspense fallback={<CatalogueBrowserSkeleton />}>
        <CatalogueBrowser params={params} filters={filters} />
      </Suspense>
    </div>
  );
}

async function CatalogueBrowser({
  params,
  filters,
}: {
  params: CatalogueSearchParams;
  filters: CatalogueFilters;
}) {
  const allProducts = await listFireworkProducts({ lightweight: true });
  const facets = catalogueFacets(allProducts, filters);
  const products = sortCatalogueProducts(
    allProducts.filter((product) => matchesCatalogueFilters(product, filters)),
    filters.sort,
  );

  const toolbarValues = {
    q: params.q ?? '',
    kind: params.kind ?? '',
    manufacturer: params.manufacturer ?? '',
    duration_min: params.duration_min ?? '',
    duration_max: params.duration_max ?? '',
    caliber: params.caliber ?? '',
    price_max: params.price_max ?? '',
    sort: filters.sort,
    effect: params.effect ?? '',
    colour: params.colour ?? '',
  };

  const totalPages = Math.max(1, Math.ceil(products.length / CATALOGUE_PAGE_SIZE));
  const currentPage = Math.min(parsePage(params.page), totalPages);
  const pageStart = (currentPage - 1) * CATALOGUE_PAGE_SIZE;
  const visibleProducts = products.slice(pageStart, pageStart + CATALOGUE_PAGE_SIZE);

  return (
    <div className="flex flex-col gap-5">
      <CatalogueToolbar
        values={toolbarValues}
        caliberOptions={facets.calibers.map((caliber) => ({
          value: caliber.value,
          label: `${caliber.label} (${caliber.count})`,
        }))}
      />

      <div className="flex flex-col gap-3">
        <EffectChips params={params} selected={filters.effect} effects={facets.effects} />
        <ColourChips params={params} selected={filters.colour} colours={facets.colours} />
      </div>

      <ActiveFilterSummary
        params={params}
        filters={filters}
        effects={facets.effects}
        resultCount={products.length}
        totalCount={allProducts.length}
      />

      {products.length === 0 ? (
        <EmptyNotice>
          No catalogue products match those filters.{' '}
          <a href={catalogueHref({}, {})} className="text-foreground underline underline-offset-4">
            Clear all filters
          </a>
        </EmptyNotice>
      ) : (
        <div className="space-y-5">
          <FireworkBrowsePreviewProvider>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {visibleProducts.map((product) => (
                <CatalogueProductCard key={product.id} product={product} />
              ))}
            </div>
          </FireworkBrowsePreviewProvider>

          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            searchParams={params}
            visibleItems={visibleProducts.length}
            totalItems={products.length}
            itemLabel="product"
          />
        </div>
      )}
    </div>
  );
}
