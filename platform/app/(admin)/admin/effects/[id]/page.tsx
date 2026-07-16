/** Admin effect detail editor with live preview and AI draft refinement. */

import { notFound } from 'next/navigation';
import { getAdminEffectById } from '@/lib/admin.server';
import { EffectEditor } from './EffectEditor';

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminEffectDetailPage({ params }: PageProps) {
  const { id } = await params;
  const effect = await getAdminEffectById(id);
  if (!effect) notFound();

  return (
    <div className="-mx-6 -my-6 flex h-[calc(100svh-3.5rem)] min-h-0 flex-1 sm:-mx-8 md:h-[calc(100svh-4.5rem)] lg:-mx-10">
      <EffectEditor key={effect.id} effect={effect} />
    </div>
  );
}
