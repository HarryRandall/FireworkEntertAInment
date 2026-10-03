/** Retailer show playback uses current published compositions and store prices. */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { readStore, readShow } from '@/lib/shopper/readers';
import { showShots } from '@/lib/shopper/playback';
import { formatPrice, storePath } from '@/lib/shopper/paths';
import { Preview } from '@/ui/shopper/preview';
import { StoreHeader, StoreFooter } from '@/ui/shopper/store-header';
import { ProductShelf } from '@/ui/shopper/shelves';
import { ViewEvent } from '@/ui/shopper/view-events';
import { Callout } from '@/ui/kit/feedback';
import { Button } from '@/ui/primitives/button';

/** Displays one accessible retailer show with its quantity-aware current shopping total. */
export default async function Page({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const store = await readStore(slug);
  if (!store) notFound();
  const show = await readShow(store.store.id, id);
  if (!show) notFound();
  const products = store.products.filter((product) =>
    show.products.some((entry) => entry.product.id === product.product_id),
  );
  return (
    <main className="min-w-0">
      <ViewEvent kind="show_view" target={id} />
      <StoreHeader store={store} />
      <Preview title={show.name} shots={showShots(show)} />
      <div className="mx-auto grid max-w-6xl min-w-0 gap-8 px-4 py-6">
        <section data-section="show-details" className="grid gap-4">
          <h1 className="text-3xl font-bold tracking-tight">{show.name}</h1>
          <p className="text-muted-foreground">
            Shopping list ·{' '}
            <b className="text-foreground tabular-nums">
              {formatPrice(show.price_minor, show.currency)}
            </b>
          </p>
          {!show.available ? (
            <Callout tone="warning" title="Some fireworks are out of stock">
              You can watch the show. Ask the shop about alternatives.
            </Callout>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href={`${storePath(slug)}/plan?show=${encodeURIComponent(id)}`}>
                Plan my show
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`${storePath(slug)}/list?show=${encodeURIComponent(id)}`}>
                Shopping list
              </Link>
            </Button>
          </div>
          <ul className="text-sm">
            {show.products.map((entry) => (
              <li key={entry.product.id}>
                {entry.quantity} × {entry.product.name}
              </li>
            ))}
          </ul>
        </section>
        <ProductShelf id="in-show" title="In this show" slug={slug} products={products} />
      </div>
      <StoreFooter store={store} />
    </main>
  );
}
