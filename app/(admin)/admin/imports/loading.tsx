/** Route-local loading state for reconstruction jobs. */

import { FileVideo2, UploadCloud } from 'lucide-react';
import { Card } from '@/app/components/ui/Card';
import { Skeleton } from '@/app/components/ui/Feedback';

export default function AdminImportsLoading() {
  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6" aria-busy="true">
      <header className="space-y-1">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight text-balance">
          Firework imports
        </h1>
        <p className="text-muted-foreground max-w-3xl text-sm text-pretty">
          Reconstruct supplier footage, compare retained evidence and publish validated fireworks.
        </p>
      </header>

      <Card className="p-5 sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <span className="bg-primary/10 text-primary grid size-10 place-items-center rounded-lg">
            <UploadCloud size={19} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-foreground text-lg font-semibold">Reconstruct from video</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Upload source footage for frame, colour, trajectory and timing analysis.
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        <Skeleton className="mt-4 h-28" />
        <div className="mt-4 flex justify-end">
          <Skeleton className="h-10 w-40" />
        </div>
      </Card>

      <section className="space-y-4" aria-labelledby="loading-jobs-heading">
        <div>
          <h2 id="loading-jobs-heading" className="text-foreground text-lg font-semibold">
            Reconstruction jobs
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Video lifecycle fields are worker-managed.
          </p>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Import job view">
          <span className="bg-secondary text-secondary-foreground inline-flex h-8 items-center rounded-md px-3 text-sm font-medium">
            Active
          </span>
          <span className="bg-secondary text-secondary-foreground inline-flex h-8 items-center rounded-md px-3 text-sm font-medium">
            Archived audit
          </span>
        </div>
        <Skeleton className="h-10 max-w-3xl" />
        <div className="border-border overflow-x-auto rounded-lg border">
          <div className="min-w-[920px]">
            <div className="border-border grid grid-cols-6 gap-4 border-b p-4">
              <span className="text-muted-foreground flex items-center gap-2 text-xs">
                <FileVideo2 size={14} aria-hidden="true" /> Source
              </span>
              {['Stage', 'Progress', 'Model', 'Updated', 'Actions'].map((label) => (
                <span key={label} className="text-muted-foreground text-xs">
                  {label}
                </span>
              ))}
            </div>
            {Array.from({ length: 5 }, (_, index) => (
              <div
                key={index}
                className="border-border grid grid-cols-6 gap-4 border-b p-4 last:border-b-0"
              >
                <Skeleton className="h-9" />
                <Skeleton className="h-6" />
                <Skeleton className="h-6" />
                <Skeleton className="h-6" />
                <Skeleton className="h-6" />
                <Skeleton className="h-9" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
