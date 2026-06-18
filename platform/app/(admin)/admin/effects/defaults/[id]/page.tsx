/** Admin editor for reusable live firework style defaults. */

import { notFound } from 'next/navigation';
import { getAdminStyleDefaultById } from '@/lib/admin.server';
import { StyleDefaultEditor } from './StyleDefaultEditor';

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminStyleDefaultDetailPage({ params }: PageProps) {
  const { id } = await params;
  const styleDefault = await getAdminStyleDefaultById(id);
  if (!styleDefault) notFound();

  return <StyleDefaultEditor styleDefault={styleDefault} />;
}
