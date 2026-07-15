import Link from 'next/link';
import { Skeleton } from '@/app/components/ui/Feedback';
import {
  DataTableShell,
  tableCellClasses,
  tableClasses,
  tableHeadClasses,
  tableHeaderCellClasses,
  tableRowClasses,
} from '@/app/components/ui/DataTable';
import { getCurrentProfile } from '@/lib/admin/current-user.server';
import { listAdminAiCreditAccounts } from '@/lib/ai-credits.server';
import { formatStableDateTime } from '@/lib/show-domain';
import { cn } from '@/lib/utils';

const creditFormatter = new Intl.NumberFormat('en-AU');

const TABLE_HEADERS = [
  { label: 'Account', numeric: false },
  { label: 'Available', numeric: true },
  { label: 'Balance', numeric: true },
  { label: 'Reserved', numeric: true },
  { label: 'Granted', numeric: true },
  { label: 'Spent', numeric: true },
  { label: 'Updated', numeric: false },
] as const;

function formatCredits(value: number) {
  return creditFormatter.format(value);
}

export async function BillingAccountsTable() {
  const [accounts, profile] = await Promise.all([listAdminAiCreditAccounts(), getCurrentProfile()]);
  const canManageUsers =
    profile?.status === 'active' && profile.permissions.includes('admin.manage_users');

  return (
    <DataTableShell viewport className="min-h-[18rem]">
      <table className={tableClasses('min-w-[980px]')} aria-describedby="billing-table-description">
        <caption className="sr-only">AI credit account balances and ledger totals</caption>
        <thead className={tableHeadClasses()}>
          <tr>
            {TABLE_HEADERS.map((header) => (
              <th
                key={header.label}
                scope="col"
                className={tableHeaderCellClasses(header.numeric ? 'text-right' : undefined)}
              >
                {header.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {accounts.length > 0 ? (
            accounts.map((account) => {
              const displayName = account.fullName || account.email || 'Unnamed user';
              const secondaryLabel =
                account.fullName && account.email ? account.email : account.userId;
              const accountIdentity = (
                <>
                  <span
                    className={cn(
                      'text-foreground block truncate text-sm font-medium',
                      canManageUsers && 'hover:underline',
                    )}
                  >
                    {displayName}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block truncate font-mono text-xs tabular-nums">
                    {secondaryLabel}
                  </span>
                </>
              );

              return (
                <tr key={account.userId} className={tableRowClasses('hover:bg-muted/35')}>
                  <td className={tableCellClasses('min-w-64 whitespace-normal')}>
                    {canManageUsers ? (
                      <Link
                        href={`/admin/users/${account.userId}`}
                        prefetch={false}
                        className="focus-visible:ring-ring/50 block min-w-0 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                      >
                        {accountIdentity}
                      </Link>
                    ) : (
                      <div className="min-w-0">{accountIdentity}</div>
                    )}
                  </td>
                  <td
                    className={tableCellClasses(
                      'text-right font-mono text-xs font-medium tabular-nums',
                    )}
                  >
                    {formatCredits(account.available)}
                  </td>
                  <td className={tableCellClasses('text-right font-mono text-xs tabular-nums')}>
                    {formatCredits(account.balance)}
                  </td>
                  <td className={tableCellClasses('text-right font-mono text-xs tabular-nums')}>
                    {formatCredits(account.reserved)}
                  </td>
                  <td className={tableCellClasses('text-right font-mono text-xs tabular-nums')}>
                    {formatCredits(account.totalGranted)}
                  </td>
                  <td className={tableCellClasses('text-right font-mono text-xs tabular-nums')}>
                    {formatCredits(account.totalSpent)}
                  </td>
                  <td
                    className={tableCellClasses(
                      'text-muted-foreground font-mono text-xs tabular-nums',
                    )}
                  >
                    <time dateTime={account.updatedAt}>
                      {formatStableDateTime(account.updatedAt)}
                    </time>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr className={tableRowClasses()}>
              <td
                colSpan={TABLE_HEADERS.length}
                className={tableCellClasses('px-6 py-16 text-center whitespace-normal')}
              >
                <p className="text-foreground text-sm font-medium">No AI credit accounts</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  No AI credit accounts have been created yet.
                </p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </DataTableShell>
  );
}

export function BillingAccountsTableSkeleton() {
  return (
    <DataTableShell viewport className="min-h-[18rem]">
      <table
        className={tableClasses('min-w-[980px]')}
        aria-label="Loading AI credit accounts"
        aria-busy="true"
      >
        <thead className={tableHeadClasses()}>
          <tr>
            {TABLE_HEADERS.map((header) => (
              <th
                key={header.label}
                scope="col"
                className={tableHeaderCellClasses(header.numeric ? 'text-right' : undefined)}
              >
                {header.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 6 }).map((_, rowIndex) => (
            <tr key={rowIndex} className={tableRowClasses()}>
              <td className={tableCellClasses('min-w-64 py-3')}>
                <Skeleton className="h-4 w-36" />
                <Skeleton className="mt-2 h-3 w-52 max-w-full" />
              </td>
              {TABLE_HEADERS.slice(1, -1).map((header) => (
                <td key={header.label} className={tableCellClasses('py-3')}>
                  <Skeleton className="ml-auto h-4 w-14" />
                </td>
              ))}
              <td className={tableCellClasses('py-3')}>
                <Skeleton className="h-4 w-36" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTableShell>
  );
}
