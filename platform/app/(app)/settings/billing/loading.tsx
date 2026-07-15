/** Stable route chrome for the `/settings/billing` loading state. */

import { CheckCircle2, ReceiptText, Sparkles } from 'lucide-react';
import { Badge } from '@/app/components/ui/Badge';
import { Skeleton } from '@/app/components/ui/Feedback';
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

const PLAN_NAMES = ['Free', 'Pro', 'Ultra'] as const;

export default function BillingSettingsLoading() {
  return (
    <div className="flex flex-col gap-4" aria-label="Loading billing">
      <div className="bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
        <div className="grid grid-cols-1 lg:grid-cols-12">
          <Card className="border-border gap-5 rounded-none border-0 border-b ring-0 lg:col-span-6 lg:border-r lg:border-b-0">
            <CardHeader>
              <CardTitle className="text-xl leading-none">
                <h1>Billing</h1>
              </CardTitle>
              <CardDescription>Loading current plan availability.</CardDescription>
              <CardAction>
                <Skeleton className="h-5 w-12 rounded-full" />
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {['Starter credits', 'Cue planning', 'Show previews', 'Shopping lists'].map(
                  (label) => (
                    <div key={label} className="text-foreground flex items-center gap-2 text-sm">
                      <CheckCircle2 aria-hidden className="text-muted-foreground size-4" />
                      <span>{label}</span>
                    </div>
                  ),
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:col-span-6 lg:grid-cols-1">
            {[
              { title: 'Current plan', icon: Sparkles },
              { title: 'Billing status', icon: ReceiptText },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Card
                  key={item.title}
                  className="border-border rounded-none border-0 border-b ring-0 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0 lg:border-r-0 lg:border-b lg:last:border-b-0"
                >
                  <CardHeader>
                    <CardTitle className="text-sm font-normal">{item.title}</CardTitle>
                    <Skeleton className="h-6 w-36" />
                    <CardAction className="bg-muted grid size-7 place-items-center rounded-md">
                      <Icon aria-hidden className="text-foreground size-4" />
                    </CardAction>
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-64 max-w-full" />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <div id="plans" className="border-border border-t px-6 py-6">
          <div className="grid gap-3 lg:grid-cols-3">
            {PLAN_NAMES.map((plan) => (
              <article key={plan} className="flex h-80 flex-col rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold">{plan}</h2>
                  <Badge solid tone="neutral">
                    Loading
                  </Badge>
                </div>
                <Skeleton className="mt-5 h-8 w-28" />
                <div className="mt-6 space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
                <Skeleton className="mt-auto h-9 w-full" />
              </article>
            ))}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Invoices</h2>
          </CardTitle>
          <CardDescription>Loading invoice availability.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="**:data-[slot='table-cell']:px-6 **:data-[slot='table-head']:px-6">
            <TableHeader className="border-t">
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={4} className="h-24">
                  <Skeleton className="mx-auto h-4 w-48" />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
