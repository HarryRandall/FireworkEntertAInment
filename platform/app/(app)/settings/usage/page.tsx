/** AI usage page showing free allowance, recent spend, and top-up status. */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowUpRight, ChevronRight, Plus, ReceiptText, Sparkles } from 'lucide-react';
import { Badge } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import { TablePagination } from '@/app/components/ui/TablePagination';
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
import { cn } from '@/lib/utils';

type PageProps = {
  searchParams?: Promise<{ usagePage?: string }>;
};

const creditFormatter = new Intl.NumberFormat('en-AU');
const FREE_SHOWS_INCLUDED = 3;
const FREE_AI_CREDITS_INCLUDED = 20;
const PRO_WEEKLY_SHOW_CREDITS = 30;
const ULTRA_WEEKLY_SHOW_CREDITS = 100;
const RECENT_USAGE_PAGE_SIZE = 5;
const USED_SHOW_SEGMENT_STYLE = {
  backgroundColor: 'color-mix(in srgb, var(--color-content-muted) 10%, var(--color-bg-elevated))',
  backgroundImage:
    'repeating-linear-gradient(90deg, color-mix(in srgb, var(--color-content-muted) 20%, transparent) 0, color-mix(in srgb, var(--color-content-muted) 20%, transparent) 8px, transparent 8px, transparent 16px)',
};
const PLAN_TIERS = [
  {
    name: 'Free',
    description: `${FREE_SHOWS_INCLUDED} free shows + ${FREE_AI_CREDITS_INCLUDED} AI credits`,
    current: true,
    href: null,
  },
  {
    name: 'Pro',
    description: `${PRO_WEEKLY_SHOW_CREDITS} shows each week`,
    current: false,
    href: '/settings/billing#plans',
  },
  {
    name: 'Ultra',
    description: `${ULTRA_WEEKLY_SHOW_CREDITS} shows each week`,
    current: false,
    href: '/settings/billing#plans',
  },
] as const;

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

function isShowGenerationUse(transaction: AiCreditTransactionSummary) {
  return (
    transaction.actionKey.startsWith('show_generation') &&
    (transaction.type === 'debit' || transaction.type === 'reserve')
  );
}

function countShowGenerationUses(transactions: AiCreditTransactionSummary[]) {
  const showReferences = new Set<string>();

  for (const transaction of transactions) {
    if (!isShowGenerationUse(transaction)) continue;
    showReferences.add(transaction.referenceId ?? transaction.id);
  }

  return showReferences.size;
}

export default async function UsageSettingsPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const credits = await getCurrentUserAiCreditSummary();
  if (!credits) redirect('/login?next=/settings/usage');

  const availableCredits = Math.max(credits.available, 0);
  const usedOrReservedFreeShows = Math.min(
    countShowGenerationUses(credits.recentTransactions),
    FREE_SHOWS_INCLUDED,
  );
  const freeShowsRemaining = Math.max(FREE_SHOWS_INCLUDED - usedOrReservedFreeShows, 0);
  const freeCreditsRemaining = Math.min(availableCredits, FREE_AI_CREDITS_INCLUDED);
  const topUpCredits = Math.max(availableCredits - FREE_AI_CREDITS_INCLUDED, 0);
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
              <Sparkles className="size-5" />
              Free allowance
            </CardTitle>
            <CardDescription>
              Your Free plan includes {FREE_SHOWS_INCLUDED} show generations and{' '}
              {FREE_AI_CREDITS_INCLUDED} flexible AI credits.
            </CardDescription>
            <CardAction>
              <Badge
                solid
                tone="success"
                className="bg-[color-mix(in_srgb,var(--hl)_18%,transparent)] text-[color:var(--hl)]"
              >
                Included
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            <FreeShowAllowance remaining={freeShowsRemaining} total={FREE_SHOWS_INCLUDED} />

            <div className="grid gap-3 sm:grid-cols-3">
              <CreditStat
                label="Free shows"
                value={`${freeShowsRemaining}/${FREE_SHOWS_INCLUDED} left`}
              />
              <CreditStat
                label="Free AI credits"
                value={`${freeCreditsRemaining}/${FREE_AI_CREDITS_INCLUDED} left`}
              />
              <CreditStat label="Top-up credits" value={creditLabel(topUpCredits)} />
            </div>
          </CardContent>
        </Card>

        <Card size="sm" className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-5" />
              Plan
            </CardTitle>
            <CardAction>
              <Badge solid tone="success">
                Current
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              {PLAN_TIERS.map((tier) => (
                <PlanTierRow key={tier.name} tier={tier} />
              ))}
            </div>
            <Button href="/settings/billing" className="w-full">
              <ArrowUpRight size={16} />
              Upgrade plan
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="pb-0">
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

function FreeShowAllowance({ remaining, total }: { remaining: number; total: number }) {
  return (
    <div className="rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-elevated)] p-4 sm:p-5">
      <ShowAllowanceSegments total={total} remaining={remaining} className="mb-6 h-3" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-mono text-2xl font-semibold tabular-nums">
          {remaining}/{total} shows left
        </p>
        <Button href="/settings/billing" variant="secondary" className="sm:w-auto">
          <Plus size={16} />
          Refill
        </Button>
      </div>
    </div>
  );
}

function PlanTierRow({ tier }: { tier: (typeof PLAN_TIERS)[number] }) {
  const className = cn(
    'flex items-start justify-between gap-3 rounded-lg border px-3 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
    tier.current
      ? 'border-[color:var(--hl)] bg-[color-mix(in_srgb,var(--hl)_9%,transparent)]'
      : 'border-[color:var(--color-border-subtle)] hover:bg-muted/60',
  );

  const content = (
    <>
      <div>
        <p className="text-sm font-semibold">{tier.name}</p>
        <p className="text-muted-foreground mt-0.5 text-xs">{tier.description}</p>
      </div>
      {tier.href ? (
        <span className="text-muted-foreground inline-flex items-center gap-1 text-xs whitespace-nowrap">
          View
          <ChevronRight size={13} />
        </span>
      ) : null}
    </>
  );

  if (tier.href) {
    return (
      <Link href={tier.href} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}

function ShowAllowanceSegments({
  total,
  remaining,
  className,
}: {
  total: number;
  remaining: number;
  className?: string;
}) {
  const safeTotal = Math.max(total, 1);
  const safeRemaining = Math.min(Math.max(remaining, 0), safeTotal);
  const used = safeTotal - safeRemaining;

  return (
    <div
      className={cn('grid gap-3', className)}
      style={{ gridTemplateColumns: `repeat(${safeTotal}, minmax(0, 1fr))` }}
      aria-hidden
    >
      {Array.from({ length: safeTotal }).map((_, index) => (
        <span
          key={index}
          className={cn(
            'min-w-0 rounded-full shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-border-subtle)_85%,transparent)]',
            index < used ? '' : 'bg-[color:var(--hl)]',
          )}
          style={index < used ? USED_SHOW_SEGMENT_STYLE : undefined}
        />
      ))}
    </div>
  );
}

function CreditStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[color:var(--color-border-subtle)] px-3 py-2.5">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-mono text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}
