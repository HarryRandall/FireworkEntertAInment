/** Product-level firework editor. */

import { FireworkEditor } from '@/app/(admin)/admin/fireworks/[id]/_components/FireworkEditor';
import { getAdminFireworkById } from '@/lib/admin/fireworks.server';
import { notFound } from 'next/navigation';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminFireworkDetailPage({ params }: PageProps) {
  const { id } = await params;
  const firework = await getAdminFireworkById(id);
  if (!firework) notFound();

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100svh-3.5rem)] min-h-0 flex-1 sm:-mx-8 md:h-[calc(100svh-4.5rem)] lg:-mx-10">
      <FireworkEditor key={firework.id} firework={firework} />
    </div>
  );
}
