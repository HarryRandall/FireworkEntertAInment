/** Loading skeleton for the `/settings/billing` route. */

import { Skeleton } from '@/app/components/ui/Feedback';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function BillingSettingsLoading() {
  return (
    <div className="space-y-4" aria-label="Loading billing">
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </CardHeader>
        <CardContent className="grid gap-3 p-6 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, rowIndex) => (
            <div key={rowIndex} className="flex items-center gap-3">
              <Skeleton className="size-5 rounded-full" />
              <Skeleton className="h-4 w-64 max-w-full" />
            </div>
          ))}
        </CardContent>
        <div className="border-border border-t px-6 py-6">
          <Skeleton className="h-5 w-24" />
          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, cardIndex) => (
              <Skeleton key={cardIndex} className="h-80 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </CardHeader>
        <CardContent className="p-6">
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
