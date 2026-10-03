/** One owned list reuses the same till view within the shared account workspace. */
import { notFound } from 'next/navigation';
import { readAccount } from '@/lib/shopper/lists/readers';
import { ListView } from '@/ui/shopper/list-view';
/** Refuses unknown or foreign list identifiers before rendering private snapshots. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await readAccount();
  const list = account.lists.find((item) => item.id === id);
  if (!list) notFound();
  return <ListView list={list} account={account} anonymous={false} />;
}
