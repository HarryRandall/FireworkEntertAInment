/** Shared catalogue skeletons used by the page's Suspense fallback and `loading.tsx`. */

import { Skeleton } from '@/app/components/ui/Feedback';

export const CATALOGUE_PAGE_SIZE = 15;

export function CatalogueSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: CATALOGUE_PAGE_SIZE }).map((_, index) => (
        <div key={index} className="border-border bg-card rounded-xl border p-4">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="mt-2 h-4 w-24" />
          <Skeleton className="mt-5 h-16 w-full" />
        </div>
      ))}
    </div>
  );
}

/** Toolbar-shaped placeholder; search text and filter state are data-driven while loading. */
export function CatalogueToolbarSkeleton() {
  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
      <Skeleton className="h-10 w-full rounded-md" />
      <Skeleton className="h-10 w-36 justify-self-center rounded-md sm:justify-self-end" />
    </div>
  );
}
