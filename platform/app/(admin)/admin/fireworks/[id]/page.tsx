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
    <div className="flex min-h-0 flex-1 flex-col gap-8">
      <FireworkEditor firework={firework} />
    </div>
  );
}
