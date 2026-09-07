import { ArrowLeft } from 'lucide-react';
import { Button } from '@/ui/patterns/Button';
import { Badge } from '@/ui/patterns/Badge';
import { notFound } from 'next/navigation';
import { getTrustedAppOrigin } from '@/lib/app-origin';
import { getAssortmentById } from '@/lib/admin/assortments.server';
import { SectionHeader } from '@/ui/patterns/SectionHeader';
import { AssortmentEditor } from './AssortmentEditor';

/** Both workspaces use the same permission-checked assortment query and editor. */
export async function AssortmentDetail({
  id,
  destination,
}: {
  id: string;
  destination: '/admin/assortments' | '/my-store/assortments';
}) {
  const assortment = await getAssortmentById(id);
  if (!assortment) notFound();
  const origin = getTrustedAppOrigin();
  const publicUrl =
    origin && assortment.publicLink ? `${origin}/a/${assortment.publicLink.publicToken}` : null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <Button href={destination} variant="ghost" size="sm">
        <ArrowLeft size={16} aria-hidden />
        All assortments
      </Button>
      <SectionHeader
        as="h1"
        title={assortment.name}
        description="Manage the pack details, products and shopper link."
        action={
          <Badge solid tone={assortment.isActive ? 'success' : 'neutral'}>
            {assortment.isActive ? 'Active' : 'Draft'}
          </Badge>
        }
      />
      <AssortmentEditor assortment={assortment} publicUrl={publicUrl} />
    </div>
  );
}
