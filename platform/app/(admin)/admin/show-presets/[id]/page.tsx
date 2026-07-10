/** Curated Explore show editor. */

import { notFound } from 'next/navigation';
import { getAdminShowPresetById } from '@/lib/admin.server';
import { listFireworkProducts } from '@/lib/shows.server';
import { ShowPresetEditor } from './ShowPresetEditor';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminShowPresetDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [preset, fireworkSpecs] = await Promise.all([
    getAdminShowPresetById(id),
    listFireworkProducts(),
  ]);
  if (!preset) notFound();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8">
      <ShowPresetEditor preset={preset} fireworkSpecs={fireworkSpecs} />
    </div>
  );
}
