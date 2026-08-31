/** My Store test show: open the real consumer QR entry point for a live assortment in a new tab, exactly what a shopper sees after scanning its physical QR code (see FIR-166). */

import { SectionHeader } from '@/components/design-system';
import { EmptyState } from '@/components/design-system/Feedback';
import { listAssortments } from '@/lib/admin/assortments.server';
import { TestShowSimulator } from './TestShowSimulator';

export default async function RetailerAdminTestShowPage() {
  const assortments = await listAssortments();
  const liveAssortments = assortments.filter((assortment) => assortment.isActive);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6">
      <SectionHeader
        title="Test a show"
        description="Pick a live assortment and open its real QR entry in a new tab, exactly what a shopper sees after scanning the code in-store."
      />

      {liveAssortments.length === 0 ? (
        <EmptyState title="No live assortments yet">
          Publish an assortment from Assortments, then come back here to test it.
        </EmptyState>
      ) : (
        <TestShowSimulator assortments={liveAssortments} />
      )}
    </div>
  );
}
