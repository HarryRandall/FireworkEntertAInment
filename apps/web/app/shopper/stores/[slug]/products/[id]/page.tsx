/** Product playback and store-specific price and stock from the public reader. */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { readStore, readProduct } from '@/lib/shopper/readers';
import { productShots } from '@/lib/shopper/playback';
import { formatPrice, storePath } from '@/lib/shopper/paths';
import { Preview } from '@/ui/shopper/preview';
import { StoreHeader, StoreFooter } from '@/ui/shopper/store-header';
import { ViewEvent } from '@/ui/shopper/view-events';
import { Badge, Callout } from '@/ui/kit/feedback';
import { Button } from '@/ui/primitives/button';

/** Shows only a published, visible product at the requested open store. */
export default async function Page({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [store, product] = await Promise.all([readStore(slug), readProduct(slug, id)]);
  if (!store || !product) notFound();
  const base = storePath(slug);
  const context = `?product=${encodeURIComponent(id)}`;
  return (
    <main className="min-w-0">
      <ViewEvent kind="product_view" target={id} />
      <StoreHeader store={store} />
      <Preview
        title={product.name}
        shots={productShots(product.playback)}
        prop={product.kind === 'cake' ? 'cake' : undefined}
      />
      <section data-section="product-details" className="mx-auto grid max-w-6xl gap-5 px-4 py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
            <p className="text-muted-foreground mt-2">
              {product.kind === 'pack' ? 'Selection pack' : product.kind} · {store.store.name}
            </p>
          </div>
          <b className="text-2xl tabular-nums">
            {formatPrice(product.price_minor, product.currency)}
          </b>
        </div>
        <div>
          <Badge tone={product.stock_qty > 0 ? 'success' : 'neutral'}>
            {product.stock_qty > 0 ? 'In stock' : 'Out of stock'}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href={`${base}/plan${context}`}>Plan a show around this</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`${base}/list${context}`}>Add to my list</Link>
          </Button>
        </div>
        <Callout title="Before you choose">
          {product.min_safety_distance_m === null
            ? 'Ask the shop about safety distance.'
            : `Minimum safety distance: ${String(product.min_safety_distance_m)} m.`}{' '}
          Stock can change. Lists do not reserve fireworks.
        </Callout>
      </section>
      <StoreFooter store={store} />
    </main>
  );
}
