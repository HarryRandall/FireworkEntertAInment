/** AI usage page showing credit limits, recent spend, and top-up status. */

import { redirect } from 'next/navigation';
import { Gauge, Plus, ReceiptText } from 'lucide-react';
import { Badge } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
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

const creditFormatter = new Intl.NumberFormat('en-AU');

function formatCredits(value: number) {
  return creditFormatter.format(value);
}

function usagePercent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (value / total) * 100));
}

function creditLabel(amount: number) {
  return `${formatCredits(amount)} ${amount === 1 ? 'credit' : 'credits'}`;
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

export default async function UsageSettingsPage() {
  const credits = await getCurrentUserAiCreditSummary();
  if (!credits) redirect('/login?next=/settings/usage');

  const hourlyUsed = credits.hourlyUsed + credits.reserved;
  const weeklyUsed = credits.weeklyUsed + credits.reserved;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="size-5" />
              AI usage
            </CardTitle>
            <CardDescription>
              Hourly and weekly limits reset automatically. Running work counts as reserved until it
              finishes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <UsageLimitRow
              label="Hourly limit"
              used={hourlyUsed}
              remaining={credits.hourlyRemaining}
              limit={credits.hourlyLimit}
              resetAt={credits.hourlyResetAt}
            />
            <UsageLimitRow
              label="Weekly limit"
              used={weeklyUsed}
              remaining={credits.weeklyRemaining}
              limit={credits.weeklyLimit}
              resetAt={credits.weeklyResetAt}
            />
            <div className="text-muted-foreground flex items-center justify-between gap-3 border-t pt-3 text-xs">
              <span>Credit balance</span>
              <span className="font-mono tabular-nums">{creditLabel(credits.balance)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add credits</CardTitle>
            <CardDescription>Top-ups will be available once paid plans launch.</CardDescription>
            <CardAction>
              <Badge solid tone="neutral">
                Coming soon
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="p-6">
            <Button type="button" variant="secondary" disabled className="w-full">
              <Plus size={16} />
              Add credits
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ReceiptText className="size-5" />
            Recent usage
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
              {credits.recentTransactions.map((transaction) => (
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
                    {new Date(transaction.createdAt).toLocaleString()}
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
        </CardContent>
      </Card>
    </div>
  );
}

function formatReset(value: string | null) {
  if (!value) return 'Resets automatically';
  return `Resets ${new Date(value).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

function UsageLimitRow({
  label,
  used,
  remaining,
  limit,
  resetAt,
}: {
  label: string;
  used: number;
  remaining: number;
  limit: number;
  resetAt: string | null;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-foreground text-sm font-medium">{label}</p>
          <p className="text-muted-foreground text-xs">{formatReset(resetAt)}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-sm font-semibold tabular-nums">
            {creditLabel(remaining)} left
          </p>
          <p className="text-muted-foreground font-mono text-xs tabular-nums">
            {formatCredits(used)} / {formatCredits(limit)}
          </p>
        </div>
      </div>
      <div aria-hidden className="bg-muted h-1.5 overflow-hidden rounded-full">
        <div
          className="bg-primary h-full rounded-full"
          style={{ width: `${usagePercent(used, limit)}%` }}
        />
      </div>
    </div>
  );
}
