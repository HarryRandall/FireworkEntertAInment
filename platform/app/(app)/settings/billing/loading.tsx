/** Loading skeleton for the `/settings/billing` route. */

import { Skeleton } from '@/app/components/ui/Feedback';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function BillingSettingsLoading() {
  return (
    <div className="space-y-6" aria-label="Loading billing">
      {Array.from({ length: 3 }).map((_, cardIndex) => (
        <Card key={cardIndex}>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </CardHeader>
          <CardContent className="space-y-3 p-6">
            {Array.from({ length: cardIndex === 0 ? 4 : 1 }).map((__, rowIndex) => (
              <div key={rowIndex} className="flex items-center gap-3">
                <Skeleton className="size-5 rounded-full" />
                <Skeleton className="h-4 w-64 max-w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
