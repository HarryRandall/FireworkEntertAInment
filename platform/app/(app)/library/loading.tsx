import { Skeleton } from "@/app/components/ui/Feedback";

export default function LibraryLoading() {
  return (
    <div className="space-y-8" aria-label="Loading show library">
      <div className="space-y-3 border-b border-outline-variant/15 pb-6">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-32 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-xl border border-outline-variant/45 bg-surface-container-low/80"
          >
            <Skeleton className="h-52 rounded-none" />
            <div className="space-y-4 p-5">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
