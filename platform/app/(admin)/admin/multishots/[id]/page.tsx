/** Multishot composition editor: place fireworks on a timeline. */

import { notFound } from 'next/navigation';
import { getMultishotById } from '@/lib/admin.server';
import { MultishotEditor } from './MultishotEditor';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminMultishotDetailPage({ params }: PageProps) {
  const { id } = await params;
  const multishot = await getMultishotById(id);
  if (!multishot) notFound();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8">
      <MultishotEditor multishot={multishot} />
    </div>
  );
}
