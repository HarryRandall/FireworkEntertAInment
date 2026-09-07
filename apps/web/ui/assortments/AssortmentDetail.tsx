import { notFound } from 'next/navigation';
import { getTrustedAppOrigin } from '@/lib/app-origin';
import { getAssortmentById } from '@/lib/admin/assortments.server';
import { SectionHeader } from '@/ui/patterns/SectionHeader';
import { AssortmentEditor } from './AssortmentEditor';

/** Both workspaces use the same permission-checked assortment query and editor. */
export async function AssortmentDetail({ id }: { id: string }) {
  const assortment = await getAssortmentById(id);
  if (!assortment) notFound();
  const origin = getTrustedAppOrigin();
  const publicUrl =
    origin && assortment.publicLink ? `${origin}/a/${assortment.publicLink.publicToken}` : null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <SectionHeader as="h1" title={assortment.name} />
      <AssortmentEditor assortment={assortment} publicUrl={publicUrl} />
    </div>
  );
}
