/** Route-local loading state for the reconstruction workbench. */

import { ArrowLeft } from 'lucide-react';
import { Card } from '@/app/components/ui/Card';
import { Skeleton } from '@/app/components/ui/Feedback';

export default function AdminImportDetailLoading() {
  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6" aria-busy="true">
      <span className="text-muted-foreground inline-flex items-center gap-2 text-sm font-medium">
        <ArrowLeft size={16} aria-hidden="true" />
        Back to imports
      </span>
      <div>
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Video reconstruction
        </p>
        <Skeleton className="mt-2 h-9 w-full max-w-xl" />
        <p className="text-muted-foreground mt-3 text-sm">
          Compare source footage, retained sampled engine evidence and the live current renderer
          before publish.
        </p>
      </div>
      <div className="grid grid-cols-6 gap-3">
        {['Upload', 'Analyse', 'Reconstruct', 'Validate', 'Review', 'Publish'].map((step) => (
          <div key={step} className="space-y-2 text-center">
            <Skeleton className="mx-auto size-6 rounded-full" />
            <span className="text-muted-foreground text-xs">{step}</span>
          </div>
        ))}
      </div>
      <Skeleton className="h-24" />
      <Card className="space-y-5 p-5 sm:p-6">
        <div>
          <h2 className="text-foreground text-xl font-semibold">Source and engine evidence</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            All available views share one inspection timeline.
          </p>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="space-y-2">
            <p className="text-foreground text-sm font-medium">Source video</p>
            <Skeleton className="aspect-video" />
          </div>
          <div className="space-y-2">
            <p className="text-foreground text-sm font-medium">Retained sampled engine evidence</p>
            <Skeleton className="aspect-video" />
          </div>
          <div className="space-y-2">
            <p className="text-foreground text-sm font-medium">
              Live current-engine reconstruction
            </p>
            <Skeleton className="aspect-video" />
          </div>
        </div>
        <Skeleton className="h-16" />
      </Card>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-foreground text-lg font-semibold">Validation evidence</h2>
          <Skeleton className="mt-4 h-60" />
        </Card>
        <Card className="p-5">
          <h2 className="text-foreground text-lg font-semibold">Effect and shot summary</h2>
          <Skeleton className="mt-4 h-60" />
        </Card>
      </div>
    </div>
  );
}
