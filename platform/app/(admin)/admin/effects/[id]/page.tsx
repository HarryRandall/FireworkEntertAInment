/** Admin effect detail editor with live preview and AI draft refinement. */

import { notFound } from 'next/navigation';
import { getAdminEffectById } from '@/lib/admin.server';
import { EffectEditor } from './EffectEditor';

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminEffectDetailPage({ params }: PageProps) {
  const { id } = await params;
  const effect = await getAdminEffectById(id);
  if (!effect) notFound();

  return <EffectEditor effect={effect} />;
}
