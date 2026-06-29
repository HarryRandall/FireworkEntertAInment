/** Loading skeleton for the `/settings/usage` route. */

import { Skeleton } from '@/app/components/ui/Feedback';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function UsageSettingsLoading() {
  return (
    <div className="space-y-4" aria-label="Loading usage">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        {Array.from({ length: 2 }).map((_, cardIndex) => (
          <Card key={cardIndex}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-72 max-w-full" />
            </CardHeader>
            <CardContent className="space-y-3 p-6">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-2 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-72 max-w-full" />
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
