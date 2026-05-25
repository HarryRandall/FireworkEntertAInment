/** Loading skeleton for the shopping-list tab. */

import { ListSkeleton } from '@/app/components/app/RouteSkeletons';

export default function ShoppingListLoading() {
  return (
    <div className="max-w-3xl" aria-label="Loading shopping list">
      <ListSkeleton rows={6} />
    </div>
  );
}
