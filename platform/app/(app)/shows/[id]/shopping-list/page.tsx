/** Shopping-list tab listing the products needed to run the show. */

import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { ShoppingListTable } from '@/app/components/app/ShoppingListTable';
import { ShoppingListSkeleton } from '@/app/components/app/RouteSkeletons';
import { getShowBySlug, listShoppingItemsForShow } from '@/lib/shows.server';
import type { Show } from '@/lib/show-domain';

type PageProps = { params: Promise<{ id: string }> };

export default async function ShowShoppingListPage({ params }: PageProps) {
  const { id } = await params;
  const show = await getShowBySlug(id);
  if (!show) notFound();
  if (show.generationStatus === 'running') redirect(`/shows/${show.slug}/generating`);

  return (
    <div className="max-w-3xl">
      <Suspense fallback={<ShoppingListSkeleton />}>
        <ShowShoppingList show={show} />
      </Suspense>
    </div>
  );
}

async function ShowShoppingList({ show }: { show: Show }) {
  const items = await listShoppingItemsForShow(show.id);
  return <ShoppingListTable items={items} />;
}
