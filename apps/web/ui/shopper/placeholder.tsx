/** Honest entry placeholders retain shop and product context without creating plans or lists. */
import Link from 'next/link';
import type { StorePage } from '@/lib/shopper/contracts';
import { storePath } from '@/lib/shopper/paths';
import { StoreHeader, StoreFooter } from './store-header';
import { EmptyState } from '@/ui/kit/feedback';
import { Button } from '@/ui/primitives/button';

/** Explains an unavailable shopper action while retaining the selected product context. */
export function ShopperPlaceholder({
  store,
  kind,
  product,
}: {
  store: StorePage;
  kind: 'plan' | 'list';
  product?: string;
}) {
  const selected = store.products.find((item) => item.product_id === product);
  return (
    <main>
      <StoreHeader store={store} />
      <section className="mx-auto grid max-w-lg gap-6 px-4 py-10">
        <h1 className="text-2xl font-semibold">
          {kind === 'plan' ? 'Plan your show' : 'Your shopping list'}
        </h1>
        {selected ? (
          <p>
            {selected.name} · {store.store.name}
          </p>
        ) : null}
        <EmptyState
          title={
            kind === 'plan' ? 'The planner is not available yet' : 'Lists are not available yet'
          }
        >
          Browse the shop or ask staff to help you choose. No plan or list has been saved.
          <Button asChild variant="outline" className="mt-4">
            <Link href={storePath(store.store.slug)}>Back to the shop</Link>
          </Button>
        </EmptyState>
      </section>
      <StoreFooter store={store} />
    </main>
  );
}
