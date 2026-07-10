/** Loading skeleton for a library template detail page.
 *
 *  Without this, the async detail page suspends against `library/loading.tsx`
 *  and the library card grid flashes when opening a template. This mirrors the
 *  detail layout: header, the replay panel, and the info aside. */

import { ReplayPanelSkeleton } from '@/app/components/app/RouteSkeletons';
import { Card } from '@/app/components/ui/Card';
import { Skeleton } from '@/app/components/ui/Feedback';

export default function LibraryDetailLoading() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5" aria-label="Loading template">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-9 w-72 max-w-full" />
          <Skeleton className="h-5 w-96 max-w-full" />
        </div>
        <Skeleton className="h-11 w-full rounded-full sm:w-40" />
      </header>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <ReplayPanelSkeleton />

        <aside className="space-y-3">
          <Card elevation="high" radius="md" className="p-4">
            <Skeleton className="h-5 w-40" />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-6 w-16 rounded-full" />
              ))}
            </div>
            <div className="mt-4 space-y-2.5">
              <Skeleton className="h-10 w-full rounded-full" />
              <Skeleton className="h-10 w-full rounded-full" />
            </div>
          </Card>

          <Card elevation="low" radius="md" className="p-4">
            <Skeleton className="h-5 w-28" />
            <div className="mt-3 space-y-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="flex items-center justify-between gap-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-14" />
                </div>
              ))}
            </div>
          </Card>

          <Card elevation="low" radius="md" className="p-4">
            <Skeleton className="h-5 w-32" />
            <div className="mt-3 space-y-4">
              <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-3">
                <div className="relative flex justify-center">
                  <span className="bg-muted absolute top-0 bottom-1/2 w-px" />
                  <span className="bg-muted absolute top-1/2 -bottom-4 w-px" />
                  <span className="bg-muted border-card absolute top-1.5 h-2.5 w-2.5 rounded-full border-2" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-4 w-10" />
                  </div>
                  <Skeleton className="mt-2 h-3 w-32" />
                </div>
              </div>
              <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-3">
                <div className="relative flex justify-center">
                  <span className="bg-muted absolute top-0 bottom-1/2 w-px" />
                  <span className="bg-muted border-card absolute top-1.5 h-2 w-2 rounded-full border-2" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-3 w-9" />
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
