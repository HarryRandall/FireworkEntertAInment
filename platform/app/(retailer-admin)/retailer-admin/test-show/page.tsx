/** Retailer-admin test show: simulate generating a show from one of this retailer's real assortments before it goes live. The generation itself is fabricated — no real cue generation or credit spend (see FIR-166). */

import { SectionHeader } from '@/app/components/ui';
import { EmptyState } from '@/app/components/ui/Feedback';
import { PreviewNotice } from '../_components/PreviewNotice';
import { listRetailerAssortments } from '../_lib/assortments.server';
import { TestShowSimulator } from './TestShowSimulator';

export default async function RetailerAdminTestShowPage() {
  const assortments = await listRetailerAssortments();

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6">
      <SectionHeader
        title="Test a show"
        description="Pick one of your assortments and simulate what a shopper would generate in-store, before you take it live."
      />

      <PreviewNotice>
        The generated result is simulated. It doesn&apos;t create a real
        show, run cue generation, or spend any credits.
      </PreviewNotice>

      {assortments.length === 0 ? (
        <EmptyState title="No assortments yet">
          Create an assortment first, then come back here to test it.
        </EmptyState>
      ) : (
        <TestShowSimulator assortments={assortments} />
      )}
    </div>
  );
}
