/** Loading skeleton for the `/settings/profile` route. */

import { Skeleton } from '@/app/components/ui/Feedback';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function ProfileSettingsLoading() {
  return (
    <div className="space-y-6" aria-label="Loading personal details">
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-4 w-64 max-w-full" />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </CardHeader>
        <CardContent className="divide-border divide-y p-0">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-64 max-w-full" />
              </div>
              <Skeleton className="h-10 w-32 rounded-md" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
