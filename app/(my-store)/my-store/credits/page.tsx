/** Retailer-admin credits: balance + top-up tiers that every in-store show draws from. Static preview data (see FIR-166). */

import { Card, SectionHeader } from '@/components/design-system';
import { PreviewNotice } from '../_components/PreviewNotice';
import { DUMMY_CREDIT_BALANCE, DUMMY_CREDIT_TIERS } from '../_lib/dummy-data';
import { CreditsTopUp } from './CreditsTopUp';

export default function RetailerAdminCreditsPage() {
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6">
      <SectionHeader
        title="Credits"
        description="Shoppers never pay. This is where the store tops up the balance every show draws down."
      />

      <PreviewNotice>
        There&apos;s no retailer-scoped credit account yet (the real ledger in{' '}
        <code className="font-mono">ai_credit_accounts</code> is per user). Nothing here is billed.
      </PreviewNotice>

      <Card className="p-5" shadow>
        <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Current balance
        </div>
        <div className="text-foreground mt-1 font-mono text-3xl font-semibold tabular-nums">
          {DUMMY_CREDIT_BALANCE.toLocaleString()} credits
        </div>
      </Card>

      <CreditsTopUp tiers={DUMMY_CREDIT_TIERS} />
    </div>
  );
}
