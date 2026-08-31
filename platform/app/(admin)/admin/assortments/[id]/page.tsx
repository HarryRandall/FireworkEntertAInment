/** Admin assortment editor: name/description/price/active, plus the member catalogue-item picker. */

import { notFound } from 'next/navigation';
import { getAssortmentById } from '@/lib/admin/assortments.server';
import { AssortmentEditor } from './AssortmentEditor';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminAssortmentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const assortment = await getAssortmentById(id);
  if (!assortment) notFound();

  return <AssortmentEditor assortment={assortment} />;
}
