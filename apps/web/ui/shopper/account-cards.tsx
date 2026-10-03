/** Token-styled owned lists and planning history within the shared workspace. */
import Link from 'next/link';
import type { ShopperAccount } from '@/lib/shopper/lists/contracts';
import { listTotal } from '@/lib/shopper/lists/totals';
import { formatPrice } from '@/lib/shopper/paths';
import { EmptyState } from '@/ui/kit/feedback';
/** Displays saved list totals using their original unit-price snapshots. */
export function AccountLists({ lists }: { lists: ShopperAccount['lists'] }) {
  if (lists.length === 0)
    return (
      <EmptyState title="No shopping lists yet">
        Add a product at a shop or save a planned show.
      </EmptyState>
    );
  return (
    <div data-section="account-lists" className="grid gap-4 md:grid-cols-2">
      {lists.map((list) => (
        <Link
          key={list.id}
          href={`/account/lists/${list.id}`}
          className="bg-card grid min-w-0 gap-2 rounded-lg border p-4 hover:border-current"
        >
          <h2 className="text-lg font-semibold">{list.store_name}</h2>
          <p>
            {list.items.length} products · {list.status}
          </p>
          <b>
            <ListTotal items={list.items} />
          </b>
          <p className="text-muted-foreground text-sm">Valid through {list.valid_until}</p>
        </Link>
      ))}
    </div>
  );
}
/** Links each persisted planning session to the owned reloadable planner view. */
export function AccountPlans({ plans }: { plans: ShopperAccount['plans'] }) {
  if (plans.length === 0)
    return <EmptyState title="No planned shows yet">Plan a show from a shop's page.</EmptyState>;
  return (
    <div data-section="account-plans" className="grid gap-4">
      {plans.map((plan) => (
        <Link
          key={plan.id}
          href={`/shopper/stores/${plan.store_slug}/plan?session=${plan.id}`}
          className="bg-card grid gap-2 rounded-lg border p-4 hover:border-current"
        >
          <h2 className="font-semibold">{plan.store_name}</h2>
          <p>
            Planned {new Date(plan.created_at).toLocaleDateString('en-GB')} · {plan.status}
          </p>
          <span className="underline">Open planned show</span>
        </Link>
      ))}
    </div>
  );
}

function ListTotal({ items }: { items: ShopperAccount['lists'][number]['items'] }) {
  const total = listTotal(items);
  return total === null ? 'No items' : formatPrice(total.minor, total.currency);
}
