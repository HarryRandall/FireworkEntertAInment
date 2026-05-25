/** Loading skeleton for the `/settings/security` route. */

import { Card } from '@/app/components/ui/Card';
import { Skeleton } from '@/app/components/ui/Feedback';

export default function SecuritySettingsLoading() {
  return (
    <div className="space-y-6" aria-label="Loading security settings">
      <Card elevation="low" radius="md" className="space-y-5 p-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </div>
          </div>
          <div className="flex justify-end">
            <Skeleton className="h-9 w-40 rounded-lg" />
          </div>
        </div>
      </Card>

      <Card radius="md" className="space-y-5 p-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <ul className="divide-outline-variant/45 border-outline-variant/45 bg-surface-container-low divide-y rounded-xl border">
          {Array.from({ length: 3 }).map((_, index) => (
            <li key={index} className="flex items-center gap-4 px-5 py-4">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="flex flex-1 items-center justify-between gap-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-40" />
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
