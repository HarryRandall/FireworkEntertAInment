/** AI usage page showing the live credit wallet, limits, and recent spend. */

import { redirect } from 'next/navigation';
import { Gauge, ReceiptText, Sparkles } from 'lucide-react';
import { Badge } from '@/components/design-system/Badge';
import { Button } from '@/components/design-system/Button';
import { TablePagination } from '@/components/design-system/TablePagination';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  getCurrentUserAiCreditSummary,
  signedAiCreditAmount,
  type AiCreditTransactionSummary,
} from '@/lib/ai-credits.server';

type PageProps = {
  searchParams?: Promise<{ usagePage?: string }>;
};

const creditFormatter = new Intl.NumberFormat('en-AU');
const activityDateFormatter = new Intl.DateTimeFormat('en-AU', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
const RECENT_USAGE_PAGE_SIZE = 5;

function formatCredits(value: number) {
  return creditFormatter.format(value);
}

function creditLabel(amount: number) {
  return `${formatCredits(amount)} ${amount === 1 ? 'credit' : 'credits'}`;
}

function parsePage(value: string | undefined) {
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function transactionTypeLabel(transaction: AiCreditTransactionSummary) {
  if (transaction.type === 'grant') return 'Credit grant';
  if (transaction.type === 'reserve') return 'Reserved';
  if (transaction.type === 'refund') return 'Released';
  if (transaction.type === 'debit') return 'Spent';
  return transaction.type;
}

function transactionCreditLabel(transaction: AiCreditTransactionSummary) {
  const signedAmount = signedAiCreditAmount(transaction);
  if (transaction.type === 'reserve') return `${creditLabel(transaction.amount)} reserved`;
  if (signedAmount > 0) return `+${creditLabel(signedAmount)}`;
  return creditLabel(Math.abs(signedAmount || transaction.amount));
}

function transactionCreditClass(transaction: AiCreditTransactionSummary) {
  const signedAmount = signedAiCreditAmount(transaction);
  if (signedAmount > 0) return 'text-[color:var(--color-status-success)]';
  if (transaction.type === 'debit') return 'text-foreground';
  return 'text-muted-foreground';
}

export default async function UsageSettingsPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const credits = await getCurrentUserAiCreditSummary();
  if (!credits) redirect('/login?next=/settings/usage');

  const recentTotalPages = Math.max(
    1,
    Math.ceil(credits.recentTransactions.length / RECENT_USAGE_PAGE_SIZE),
  );
  const currentRecentPage = Math.min(parsePage(params.usagePage), recentTotalPages);
  const recentPageStart = (currentRecentPage - 1) * RECENT_USAGE_PAGE_SIZE;
  const visibleRecentTransactions = credits.recentTransactions.slice(
    recentPageStart,
    recentPageStart + RECENT_USAGE_PAGE_SIZE,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge aria-hidden className="size-5" />
              <h1>AI credit balance</h1>
            </CardTitle>
            <CardDescription>
              New accounts receive a one-off {creditLabel(credits.includedCredits)} starter grant.
              AI actions draw from this wallet. Generation and refinement costs are shown before you
              confirm those actions.
            </CardDescription>
            <CardAction>
              <Badge
                solid
                tone="success"
                className="bg-[color-mix(in_srgb,var(--hl)_18%,transparent)] text-[color:var(--hl)]"
              >
                Free
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            <dl className="grid gap-3 sm:grid-cols-3">
              <CreditStat
                label="Wallet balance"
                value={creditLabel(Math.max(credits.balance, 0))}
              />
              <CreditStat
                label="Available now"
                value={creditLabel(Math.max(credits.available, 0))}
              />
              <CreditStat label="Reserved" value={creditLabel(Math.max(credits.reserved, 0))} />
            </dl>

            <div className="rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-elevated)] p-4 sm:p-5">
              <h2 className="font-heading text-sm font-medium">Usage limits</h2>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                <CreditStat
                  label="Hourly remaining"
                  value={`${formatCredits(credits.hourlyRemaining)}/${formatCredits(
                    credits.hourlyLimit,
                  )} credits`}
                />
                <CreditStat
                  label="Weekly remaining"
                  value={`${formatCredits(credits.weeklyRemaining)}/${formatCredits(
                    credits.weeklyLimit,
                  )} credits`}
                />
              </dl>
              <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
                Available now accounts for the wallet balance, reserved credits, and the current
                hourly and weekly spend limits. The hourly limit is not an extra credit allowance.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card size="sm" className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles aria-hidden className="size-5" />
              <h2>Plan</h2>
            </CardTitle>
            <CardAction>
              <Badge solid tone="success">
                Current
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-[color:var(--hl)] bg-[color-mix(in_srgb,var(--hl)_9%,transparent)] px-3 py-3">
              <p className="text-sm font-semibold">Free</p>
              <p className="text-muted-foreground mt-1 text-xs">
                The only plan available during the beta.
              </p>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Pro and Ultra pricing, allowances, and upgrades are not finalised. You cannot change
              plans yet.
            </p>
            <Button href="/settings/billing" variant="secondary" className="w-full">
              View billing details
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="pb-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ReceiptText aria-hidden className="size-5" />
            <h2>Recent usage</h2>
          </CardTitle>
          <CardDescription>
            What credits were used for, when, and how many were spent.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="**:data-[slot='table-cell']:px-6 **:data-[slot='table-head']:px-6">
            <TableHeader className="border-t">
              <TableRow>
                <TableHead>What it was for</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Credits</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRecentTransactions.map((transaction) => (
                <TableRow key={transaction.id} className="hover:bg-muted/45">
                  <TableCell>
                    <div>
                      <p className="font-medium">{transaction.label}</p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {transaction.referenceType ?? 'Account'}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>{transactionTypeLabel(transaction)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    <time dateTime={transaction.createdAt}>
                      {activityDateFormatter.format(new Date(transaction.createdAt))}
                    </time>
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono tabular-nums ${transactionCreditClass(
                      transaction,
                    )}`}
                  >
                    {transactionCreditLabel(transaction)}
                  </TableCell>
                </TableRow>
              ))}
              {credits.recentTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground h-24 text-center">
                    No AI usage has been recorded yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          {credits.recentTransactions.length > RECENT_USAGE_PAGE_SIZE ? (
            <div className="border-t px-6 py-3">
              <TablePagination
                currentPage={currentRecentPage}
                totalPages={recentTotalPages}
                searchParams={{ usagePage: params.usagePage }}
                pageKey="usagePage"
                visibleItems={visibleRecentTransactions.length}
                totalItems={credits.recentTransactions.length}
                itemLabel="activity"
                itemLabelPlural="activities"
              />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function CreditStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[color:var(--color-border-subtle)] px-3 py-2.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-mono text-sm font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
