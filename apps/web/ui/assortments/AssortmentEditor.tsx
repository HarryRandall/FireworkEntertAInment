import type { AdminAssortmentDetail } from '@/lib/admin/assortments.server';
import { AssortmentDetailsForm } from './AssortmentDetailsForm';
import { AssortmentProducts } from './AssortmentProducts';
import { AssortmentQrPanel } from './AssortmentQrPanel';

export function AssortmentEditor({
  assortment,
  publicUrl,
}: {
  assortment: AdminAssortmentDetail;
  publicUrl: string | null;
}) {
  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-6">
        <AssortmentDetailsForm key={assortment.id} assortment={assortment} />
        <AssortmentProducts assortment={assortment} />
      </div>
      <AssortmentQrPanel assortment={assortment} publicUrl={publicUrl} />
    </div>
  );
}
