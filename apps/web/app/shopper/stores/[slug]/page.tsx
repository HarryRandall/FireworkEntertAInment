/** Public shop range and featured playback, independent of the workspace shell. */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { readStore, readShow } from '@/lib/shopper/readers';
import { showShots } from '@/lib/shopper/playback';
import { storePath } from '@/lib/shopper/paths';
import { Preview } from '@/ui/shopper/preview';
import { ShowCard } from '@/ui/shopper/show-card';
import { StoreHeader, StoreFooter } from '@/ui/shopper/store-header';
import { ProductShelf, CollectionShelves, SHELF_LAYOUT_CLASS } from '@/ui/shopper/shelves';
import { Suspense } from 'react';
import { ScanEvent, ViewEvent } from '@/ui/shopper/view-events';
import { Button } from '@/ui/primitives/button';
import { EmptyState } from '@/ui/kit/feedback';

/** Reads the published store range and first playable retailer show. */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ collection?: string }>;
}) {
  const { slug } = await params;
  const { collection } = await searchParams;
  const store = await readStore(slug);
  if (!store) notFound();
  const shows = await Promise.all(store.shows.map((show) => readShow(store.store.id, show.id)));
  const featured = shows.find((show) => show !== null);
  return (
    <main className="min-w-0">
      <ViewEvent type="store_view" store={store.store.id} target={store.store.id} />
      <Suspense>
        <ScanEvent store={store.store.id} />
      </Suspense>
      <StoreHeader store={store} />
      {featured ? (
        <Preview
          shots={showShots(featured)}
          title={featured.name}
          event={{ store: store.store.id, context: { show_id: featured.id } }}
        />
      ) : null}
      <div className="mx-auto grid max-w-6xl min-w-0 gap-8 px-4 py-6">
        <section
          data-section="introduction"
          className="flex flex-wrap items-end justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{store.organisation.name}</h1>
            <p className="text-muted-foreground mt-2">
              {store.branding?.welcome ?? `Explore fireworks at ${store.store.name}.`}
            </p>
          </div>
          <Button asChild>
            <Link href={`${storePath(slug)}/plan`}>Plan my show</Link>
          </Button>
        </section>
        <section data-section="shows" aria-label="Featured shows" className="grid gap-3">
          <h2 className="text-lg font-semibold">Shows from this shop</h2>
          {shows.some(Boolean) ? (
            <div className={SHELF_LAYOUT_CLASS}>
              {shows.map((show) =>
                show ? <ShowCard key={show.id} show={show} slug={slug} /> : null,
              )}
            </div>
          ) : (
            <EmptyState title="No shows available yet">
              Explore individual fireworks below.
            </EmptyState>
          )}
        </section>
        <CollectionShelves store={store} selected={collection} />
        <ProductShelf id="products" title="All fireworks" products={store.products} slug={slug} />
      </div>
      <StoreFooter store={store} />
    </main>
  );
}
