/** Loading skeleton for the admin cover-poster backfill route. */

import { Card } from '@/app/components/ui/Card';
import { Skeleton } from '@/app/components/ui/Feedback';

export default function AdminCoverPostersLoading() {
  return (
    <div className="flex flex-col gap-5" aria-label="Loading cover posters">
      <header className="flex flex-col gap-1">
        <h1 className="text-on-surface text-2xl font-black">Cover posters</h1>
        <p className="text-on-surface-variant text-sm leading-relaxed">
          Render each show preset&apos;s shader cover to a PNG stored in the public covers bucket,
          so browse pages show a static image instead of a live WebGL context per card. Renders run
          in your browser; uploaded posters are written through the service role.
        </p>
      </header>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-9 w-36 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <Card key={index} radius="md" className="overflow-hidden">
              <div className="bg-surface-container relative aspect-[4/5] w-full">
                <Skeleton className="h-full w-full rounded-none" />
              </div>
              <div className="flex items-center justify-between gap-2 p-3">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
