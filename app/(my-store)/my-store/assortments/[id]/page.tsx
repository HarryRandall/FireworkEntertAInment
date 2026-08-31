/**
 * Retailer-admin assortment editor. Reuses the real AssortmentEditor
 * component from /admin/assortments verbatim — it's already self-contained
 * and only depends on admin.manage_assortments, not admin.view, so it works
 * unchanged for a retailer account that can't reach /admin/*. See FIR-166.
 */

import { notFound } from 'next/navigation';
import { getTrustedAppOrigin } from '@/lib/app-origin';
import { getAssortmentById } from '@/lib/admin/assortments.server';
import { AssortmentEditor } from '@/app/(admin)/admin/assortments/[id]/AssortmentEditor';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function RetailerAdminAssortmentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const assortment = await getAssortmentById(id);
  if (!assortment) notFound();
  const origin = getTrustedAppOrigin();
  const publicUrl =
    origin && assortment.publicLink ? `${origin}/a/${assortment.publicLink.publicToken}` : null;

  return <AssortmentEditor assortment={assortment} publicUrl={publicUrl} />;
}
