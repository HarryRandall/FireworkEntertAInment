/** Read-only firework catalogue page for the app sidebar. */

import { Suspense } from 'react';
import { Search } from 'lucide-react';
import { Badge } from '@/app/components/ui/Badge';
import { Skeleton } from '@/app/components/ui/Feedback';
import { listFireworkProducts } from '@/lib/shows.server';
import { formatDuration } from '@/lib/show-domain';

type PageProps = {
  searchParams?: Promise<{ q?: string }>;
};

function matchesProduct(
  product: Awaited<ReturnType<typeof listFireworkProducts>>[number],
  query: string,
) {
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

export default async function CataloguePage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const query = params.q ?? '';

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold tracking-tight text-[color:var(--color-content-emphasis)]">
          Catalogue
        </h1>
        <p className="text-sm text-[color:var(--color-content-subtle)]">
          Browse firework products available for show planning.
        </p>
      </header>

      <form className="flex max-w-xl items-center gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search catalogue</span>
          <Search
            size={15}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[color:var(--color-content-muted)]"
          />
          <input
            name="q"
            defaultValue={query}
            placeholder="Search name, effect, code"
            className="border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-md border pr-3 pl-9 text-sm shadow-xs focus:outline-none focus-visible:ring-3"
          />
        </label>
        <button
          type="submit"
          className="border-border bg-background text-foreground hover:bg-muted focus-visible:ring-ring/50 h-10 rounded-md border px-3 text-sm font-medium shadow-xs transition-colors focus:outline-none focus-visible:ring-3"
        >
          Search
        </button>
      </form>

      <Suspense fallback={<CatalogueSkeleton />}>
        <CatalogueList query={query} />
      </Suspense>
    </div>
  );
}

async function CatalogueList({ query }: { query: string }) {
  const products = (await listFireworkProducts()).filter((product) =>
    matchesProduct(product, query),
  );

  if (products.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-[color:var(--color-border-subtle)] p-6 text-sm text-[color:var(--color-content-subtle)]">
        No catalogue products match that search.
      </div>
    );
  }

  return (
    <div className="bg-card overflow-hidden rounded-xl border border-[color:var(--color-border-subtle)]">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[color:var(--color-border-subtle)] text-xs text-[color:var(--color-content-muted)] uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Effect</th>
              <th className="px-4 py-3 font-medium">Duration</th>
              <th className="px-4 py-3 font-medium">Calibre</th>
            </tr>
          </thead>
          <tbody>
            {products.slice(0, 80).map((product) => (
              <tr
                key={product.id}
                className="border-b border-[color:var(--color-border-subtle)] last:border-b-0"
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-[color:var(--color-content-emphasis)]">
                    {product.name}
                  </div>
                  <div className="text-xs text-[color:var(--color-content-subtle)]">
                    {product.slug}
                  </div>
                </td>
                <td className="px-4 py-3 text-[color:var(--color-content-subtle)]">
                  {product.baseEffect?.name ?? product.description ?? 'Uncategorised'}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[color:var(--color-content-emphasis)] tabular-nums">
                  {formatDuration(product.durationSeconds)}
                </td>
                <td className="px-4 py-3">
                  {product.caliber ? <Badge tone="neutral">{product.caliber}</Badge> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CatalogueSkeleton() {
  return (
    <div className="border-border bg-card overflow-hidden rounded-xl border">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="border-border border-b px-4 py-3 last:border-b-0">
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}
