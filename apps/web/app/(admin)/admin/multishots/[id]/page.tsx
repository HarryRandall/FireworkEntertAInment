/** Multishot composition editor: place fireworks on a single-mortar timeline. */

import { readFinaleCakeEffects } from '@/lib/finale/catalogue.server';
import { notFound } from 'next/navigation';
import { getMultishotById } from '@/lib/admin/multishots.server';
import { listFireworkSpecifications } from '@/lib/shows/queries.server';
import { MultishotEditor } from '@/app/(admin)/admin/multishots/[id]/_components/MultishotEditor';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminMultishotDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [multishot, fireworkSpecs, catalogue] = await Promise.all([
    getMultishotById(id),
    listFireworkSpecifications(),
    readFinaleCakeEffects(),
  ]);
  if (!multishot) notFound();
  if (!catalogue.ok) throw new Error(catalogue.error);

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-8">
      <MultishotEditor
        multishot={multishot}
        fireworkSpecs={fireworkSpecs}
        finaleEffects={catalogue.effects}
      />
    </div>
  );
}
