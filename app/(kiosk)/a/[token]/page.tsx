import { notFound } from 'next/navigation';
import { getPublicAssortmentByToken } from '@/lib/assortments/public.server';
import { AssortmentEntryClient } from './AssortmentEntryClient';

export const dynamic = 'force-dynamic';

export default async function AssortmentEntryPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const assortment = await getPublicAssortmentByToken(token);
  if (!assortment) notFound();

  return (
    <AssortmentEntryClient
      token={token}
      assortment={{
        name: assortment.name,
        description: assortment.description,
        priceCents: assortment.priceCents,
        items: assortment.items,
      }}
    />
  );
}
