/** Admin AI billing page for reviewing credit account balances and ledger totals. */

import { Suspense } from 'react';
import { BillingAccountsTable, BillingAccountsTableSkeleton } from './BillingAccountsTable';

export default function AdminBillingPage() {
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight text-balance">
          AI billing
        </h1>
        <p
          id="billing-table-description"
          className="text-muted-foreground max-w-3xl text-sm text-pretty"
        >
          Review current balances, reservations and ledger totals for every AI credit account.
        </p>
      </header>

      <Suspense fallback={<BillingAccountsTableSkeleton />}>
        <BillingAccountsTable />
      </Suspense>
    </div>
  );
}
