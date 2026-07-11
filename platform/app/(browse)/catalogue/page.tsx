/** Read-only firework catalogue page for the app sidebar. */

import { Suspense } from 'react';
import type { ReactNode } from 'react';
import { Clock3, Layers3, Sparkles, Ruler } from 'lucide-react';
import { Badge } from '@/app/components/ui/Badge';
import { EmptyNotice } from '@/app/components/ui/Feedback';
import { TablePagination } from '@/app/components/ui/TablePagination';
import { listFireworkProducts } from '@/lib/shows.server';
import { formatDuration } from '@/lib/show-domain';
import { CATALOGUE_PAGE_SIZE, CatalogueSkeleton } from './CatalogueSkeleton';
import { CatalogueToolbar } from './CatalogueToolbar';

type PageProps = {
  searchParams?: Promise<{ kind?: string; page?: string; q?: string }>;
};

type CatalogueProduct = Awaited<ReturnType<typeof listFireworkProducts>>[number];

function matchesProduct(product: CatalogueProduct, query: string, kind: string) {
  const shotCount = product.shotCount ?? 1;
  if (kind === 'single' && shotCount > 1) return false;
  if (kind === 'multishot' && shotCount <= 1) return false;

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

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <header>
        <h1 className="text-foreground text-2xl font-bold tracking-tight">Firework catalogue</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
          Browse the products and effects available for ShowCrafter timelines.
        </p>
      </header>
      <CatalogueToolbar kind={kind} query={query} />

      <Suspense fallback={<CatalogueSkeleton />}>
        <CatalogueList kind={kind} page={params.page} query={query} />
      </Suspense>
    </div>
  );
}

async function CatalogueList({
  kind,
  page,
  query,
}: {
  kind: string;
  page?: string;
  query: string;
}) {
  const products = (await listFireworkProducts({ lightweight: true })).filter((product) =>
    matchesProduct(product, query, kind),
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
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visibleProducts.map((product) => (
          <article
            key={product.id}
            className="border-border bg-card min-w-0 rounded-xl border p-4 shadow-xs transition-colors hover:border-[color:var(--color-border-strong)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-foreground line-clamp-2 text-sm leading-5 font-semibold">
                  {product.name}
                </h2>
                <p className="text-muted-foreground mt-1 font-mono text-xs">{product.slug}</p>
              </div>
              {product.caliber ? (
                <Badge tone="neutral" className="shrink-0">
                  {product.caliber}
                </Badge>
              ) : null}
            </div>

            <p className="text-muted-foreground mt-3 line-clamp-2 text-sm leading-relaxed [overflow-wrap:anywhere]">
              {product.description ?? product.baseEffect?.name ?? 'Uncategorised firework'}
            </p>

            <div className="text-muted-foreground mt-4 grid grid-cols-2 gap-2 text-xs">
              <CatalogueMeta icon={<Sparkles size={13} />} label="Effect">
                {product.baseEffect?.name ?? 'Uncategorised'}
              </CatalogueMeta>
              <CatalogueMeta icon={<Clock3 size={13} />} label="Duration">
                {formatDuration(product.durationSeconds)}
              </CatalogueMeta>
              <CatalogueMeta icon={<Layers3 size={13} />} label="Shots">
                {product.shotCount ? product.shotCount.toLocaleString() : '1'}
              </CatalogueMeta>
              <CatalogueMeta icon={<Ruler size={13} />} label="Height">
                {product.heightMeters ? `${product.heightMeters}m` : 'Not set'}
              </CatalogueMeta>
            </div>

            {product.variant?.colorPalette?.length ? (
              <div className="mt-4 flex items-center gap-1.5" aria-label="Colour palette">
                {product.variant.colorPalette.slice(0, 5).map((color, index) => (
                  <span
                    key={`${product.id}-${color}-${index}`}
                    className="h-3 w-8 rounded-full border border-white/20 shadow-sm"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>

      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        searchParams={{ kind: kind || undefined, q: query || undefined }}
        visibleItems={visibleProducts.length}
        totalItems={products.length}
        itemLabel="product"
      />
    </div>
  );
}

function CatalogueMeta({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-muted/60 rounded-lg px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.08em] text-[color:var(--color-content-muted)] uppercase">
        {icon}
        {label}
      </div>
      <div className="text-foreground mt-1 truncate text-xs font-medium">{children}</div>
    </div>
  );
}
