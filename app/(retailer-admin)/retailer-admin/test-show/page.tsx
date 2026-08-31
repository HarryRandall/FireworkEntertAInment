/** Retailer-admin test show: simulate generating a show from one of the real, live assortments before relying on it in-store. The generation itself is fabricated — no real cue generation or credit spend (see FIR-166). */

import { SectionHeader } from '@/components/design-system';
import { EmptyState } from '@/components/design-system/Feedback';
import { listAssortments } from '@/lib/admin/assortments.server';
import { PreviewNotice } from '../_components/PreviewNotice';
import { TestShowSimulator } from './TestShowSimulator';

export default async function RetailerAdminTestShowPage() {
  const assortments = await listAssortments();
  const liveAssortments = assortments.filter((assortment) => assortment.isActive);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6">
      <SectionHeader
        title="Test a show"
        description="Pick a live assortment and simulate what a shopper would generate in-store."
      />

      <PreviewNotice>
        The generated result is simulated. It doesn&apos;t create a real show, run cue generation,
        or spend any credits.
      </PreviewNotice>

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
