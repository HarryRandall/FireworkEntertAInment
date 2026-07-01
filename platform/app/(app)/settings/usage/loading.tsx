/** Loading skeleton for the `/settings/usage` route. */

import { ReceiptText, Sparkles } from 'lucide-react';
import { Skeleton } from '@/app/components/ui/Feedback';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function UsageSettingsLoading() {
  return (
    <div className="space-y-4" aria-label="Loading usage">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-5" />
              Free allowance
            </CardTitle>
            <CardDescription>Loading your free shows and AI credits.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="flex gap-1.5">
              <Skeleton className="h-2 flex-1 rounded-full" />
              <Skeleton className="h-2 flex-1 rounded-full" />
              <Skeleton className="h-2 flex-1 rounded-full" />
            </div>
            <Skeleton className="h-12 w-44" />
            <div className="grid gap-3 sm:grid-cols-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-5" />
              Plan
            </CardTitle>
            <CardDescription>Loading plan allowance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ReceiptText className="size-5" />
            Recent usage
          </CardTitle>
          <CardDescription>Loading recent credit activity.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 p-6">
          {Array.from({ length: 5 }).map((_, rowIndex) => (
            <Skeleton key={rowIndex} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
