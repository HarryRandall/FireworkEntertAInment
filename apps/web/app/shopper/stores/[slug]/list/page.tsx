/** Public shopper action entry preserves context and clearly reports availability. */
import { notFound } from 'next/navigation';
import { readStore } from '@/lib/shopper/readers';
import { ShopperPlaceholder } from '@/ui/shopper/placeholder';
/** Displays the store-specific action entry without writing shopper data. */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ product?: string }>;
}) {
  const { slug } = await params;
  const { product } = await searchParams;
  const store = await readStore(slug);
  if (!store) notFound();
  return <ShopperPlaceholder store={store} kind="list" product={product} />;
}
