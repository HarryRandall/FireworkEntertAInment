/** Stable loading chrome for the admin AI billing account list. */

import { BillingAccountsTableSkeleton } from './BillingAccountsTable';

export default function AdminBillingLoading() {
  return (
    <div
      className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-6"
      aria-label="Loading AI billing"
    >
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

      <BillingAccountsTableSkeleton />
    </div>
  );
}
