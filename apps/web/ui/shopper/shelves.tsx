/** Mobile-first public range shelves with collection filters and published product posters. */
import type { StorePage, StoreProduct } from '@/lib/shopper/contracts';
import { ProductCard } from './product-card';
import { EmptyState } from '@/ui/kit/feedback';

/** QR prototype shelf columns stay between 200 and 240 CSS pixels, inside a local scroll region. */
export const SHELF_LAYOUT_CLASS =
  'grid snap-x grid-flow-col auto-cols-[minmax(200px,240px)] gap-4 overflow-x-auto p-1 pb-3';

/** Displays one scrollable shelf whose overflow stays within the page width. */
export function ProductShelf({
  title,
  products,
  slug,
  id,
}: {
  title: string;
  products: readonly StoreProduct[];
  slug: string;
  id: string;
}) {
  return (
    <section id={id} data-section={id} aria-label={title} className="grid min-w-0 gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {products.length > 0 ? (
        <div className={SHELF_LAYOUT_CLASS}>
          {products.map((product) => (
            <ProductCard key={product.product_id} product={product} slug={slug} />
          ))}
        </div>
      ) : (
        <EmptyState title="No fireworks here yet">Ask the shop about its current range.</EmptyState>
      )}
    </section>
  );
}
/** Displays live collections only, optionally narrowing to a scanned collection. */
export function CollectionShelves({ store, selected }: { store: StorePage; selected?: string }) {
  const collections =
    selected !== undefined
      ? store.collections.filter((collection) => collection.id === selected)
      : store.collections;
  return (
    <div id="collections" className="grid min-w-0 gap-8">
      {collections.map((collection) => (
        <ProductShelf
          key={collection.id}
          id={`collection-${collection.id}`}
          title={collection.name}
          slug={store.store.slug}
          products={store.products.filter((product) =>
            collection.product_ids.includes(product.product_id),
          )}
        />
      ))}
      {selected !== undefined && collections.length === 0 ? (
        <EmptyState title="This collection is unavailable">
          Browse the shop's full range below.
        </EmptyState>
      ) : null}
    </div>
  );
}
