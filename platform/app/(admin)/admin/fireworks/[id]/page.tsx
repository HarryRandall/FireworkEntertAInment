/** Product-level firework editor. */

import { notFound } from 'next/navigation';
import { getAdminFireworkById } from '@/lib/admin.server';
import { FireworkEditor } from './FireworkEditor';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminFireworkDetailPage({ params }: PageProps) {
  const { id } = await params;
  const firework = await getAdminFireworkById(id);
  if (!firework) notFound();

  return (
    <div className="-mx-6 -my-6 flex h-[calc(100svh-3.5rem)] min-h-0 flex-1 sm:-mx-8 md:h-[calc(100svh-4.5rem)] lg:-mx-10">
      <FireworkEditor key={firework.id} firework={firework} />
    </div>
  );
}
