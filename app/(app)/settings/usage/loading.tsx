/** Stable route chrome for the `/settings/usage` loading state. */

import { Gauge, ReceiptText, Sparkles } from 'lucide-react';
import { Skeleton } from '@/components/design-system/Feedback';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function LoadingStat({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-[color:var(--color-border-subtle)] px-3 py-2.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-1">
        <Skeleton className="h-4 w-24" />
      </dd>
    </div>
  );
}

export default function UsageSettingsLoading() {
  return (
    <div className="space-y-4" aria-label="Loading usage">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge aria-hidden className="size-5" />
              <h1>AI credit balance</h1>
            </CardTitle>
            <CardDescription>Loading your credit wallet and current usage limits.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            <dl className="grid gap-3 sm:grid-cols-3">
              <LoadingStat label="Wallet balance" />
              <LoadingStat label="Available now" />
              <LoadingStat label="Reserved" />
            </dl>
            <div className="space-y-3 rounded-xl border p-4 sm:p-5">
              <h2 className="text-sm font-medium">Usage limits</h2>
              <dl className="grid gap-3 sm:grid-cols-2">
                <LoadingStat label="Hourly remaining" />
                <LoadingStat label="Weekly remaining" />
              </dl>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles aria-hidden className="size-5" />
              <h2>Plan</h2>
            </CardTitle>
            <CardDescription>Loading current plan details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
      <Card className="pb-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ReceiptText aria-hidden className="size-5" />
            <h2>Recent usage</h2>
          </CardTitle>
          <CardDescription>Loading recent credit activity.</CardDescription>
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
              {Array.from({ length: 5 }).map((_, rowIndex) => (
                <TableRow key={rowIndex}>
                  {Array.from({ length: 4 }).map((__, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <Skeleton className={`h-4 ${cellIndex === 0 ? 'w-40' : 'w-20'}`} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
