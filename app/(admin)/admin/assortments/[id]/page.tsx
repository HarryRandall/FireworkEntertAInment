/** Admin assortment editor: name/description/price/active, plus the member catalogue-item picker. */

import { notFound } from 'next/navigation';
import { getTrustedAppOrigin } from '@/lib/app-origin';
import { getAssortmentById } from '@/lib/admin/assortments.server';
import { AssortmentEditor } from './AssortmentEditor';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminAssortmentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const assortment = await getAssortmentById(id);
  if (!assortment) notFound();
  const origin = getTrustedAppOrigin();
  const publicUrl =
    origin && assortment.publicLink ? `${origin}/a/${assortment.publicLink.publicToken}` : null;

  return <AssortmentEditor assortment={assortment} publicUrl={publicUrl} />;
}
