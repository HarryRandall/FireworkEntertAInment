/** Admin effect detail editor with live preview and AI draft refinement. */

import { notFound } from 'next/navigation';
import { AppPageHeader } from '@/app/components/app/AppPageHeader';
import { getAdminEffectById } from '@/lib/admin.server';
import { EffectEditor } from './EffectEditor';

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminEffectDetailPage({ params }: PageProps) {
  const { id } = await params;
  const effect = await getAdminEffectById(id);
  if (!effect) notFound();

  return (
    <div className="space-y-6">
      <AppPageHeader
        title={effect.name}
        description={`${effect.family} base effect, ${effect.variantCount} variants.`}
        breadcrumbs={[{ label: 'Effects', href: '/admin/effects' }, { label: effect.name }]}
      />
      <EffectEditor effect={effect} />
    </div>
  );
}
