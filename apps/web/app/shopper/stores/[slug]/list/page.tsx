/** Store-specific anonymous or permanent shopper list entry under the existing session. */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { readStore } from '@/lib/shopper/readers';
import { readAccount } from '@/lib/shopper/lists/readers';
import { getIdentity } from '@/lib/auth/server';
import { ListView } from '@/ui/shopper/list-view';
import { StoreHeader, StoreFooter } from '@/ui/shopper/store-header';
/** Reads only owned lists at the requested shop, with an explicit empty state. */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ id?: string }>;
}) {
  const { slug } = await params;
  const { id } = await searchParams;
  if (id !== undefined && !z.string().uuid().safeParse(id).success) notFound();
  const store = await readStore(slug);
  if (!store) notFound();
  const account = await readAccount();
  const identity = await getIdentity();
  const list =
    id !== undefined
      ? account.lists.find((item) => item.id === id && item.store_id === store.store.id)
      : account.lists.find((item) => item.store_id === store.store.id && item.status === 'open');
  if (id !== undefined && !list) notFound();
  return (
    <main className="min-w-0">
      <StoreHeader store={store} />
      <div className="mx-auto grid max-w-3xl gap-6 px-4 py-6">
        {list ? (
          <ListView list={list} account={account} anonymous={identity?.access.anonymous ?? true} />
        ) : (
          <>
            <h1 className="text-3xl font-bold">Your list is empty</h1>
            <p>Add products as you browse, or save a planned show.</p>
            <Link className="underline" href={`/shopper/stores/${slug}`}>
              Browse the shop
            </Link>
          </>
        )}
      </div>
      <StoreFooter store={store} />
    </main>
  );
}
