/** Admin editor for reusable live firework style defaults. */

import { notFound } from 'next/navigation';
import { getAdminStyleDefaultById } from '@/lib/admin.server';
import { StyleDefaultEditor } from './StyleDefaultEditor';

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminStyleDefaultDetailPage({ params }: PageProps) {
  const { id } = await params;
  const styleDefault = await getAdminStyleDefaultById(id);
  if (!styleDefault) notFound();

  return (
    <div className="-mx-6 -my-6 flex h-[calc(100svh-3.5rem)] min-h-0 flex-1 sm:-mx-8 md:h-[calc(100svh-4.5rem)] lg:-mx-10">
      <StyleDefaultEditor key={styleDefault.id} styleDefault={styleDefault} />
    </div>
  );
}
