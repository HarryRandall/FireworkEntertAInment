/** Loading skeleton for the `/settings/profile` route. */

import { Skeleton } from '@/app/components/ui/Feedback';

export default function ProfileSettingsLoading() {
  return (
    <div className="space-y-6" aria-label="Loading personal details">
      <div className="border-outline-variant/45 bg-surface-container-low space-y-6 rounded-xl border p-5 shadow-[var(--shadow-card)] sm:p-6">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-3 w-56" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-3 w-32" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        </div>
      </div>

      <div className="border-outline-variant/45 bg-surface-container-low flex items-center justify-between gap-4 rounded-xl border p-5 sm:p-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-64" />
        </div>
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>

      <div className="border-outline-variant/45 bg-surface-container-low flex items-center justify-between gap-4 rounded-xl border p-5 sm:p-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-72" />
        </div>
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>
    </div>
  );
}
