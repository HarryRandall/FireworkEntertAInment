/** Shared catalogue skeletons used by the page's Suspense fallback and `loading.tsx`. */

import { FireworkBrowseGridSkeleton } from '@/ui/catalogue/FireworkBrowseCard';
import { Skeleton } from '@/ui/patterns/Feedback';

export const CATALOGUE_PAGE_SIZE = 15;

function CatalogueSkeleton() {
  return <FireworkBrowseGridSkeleton count={CATALOGUE_PAGE_SIZE} />;
}

/** Toolbar-shaped placeholder mirroring `CatalogueToolbar`: a full-width search
 *  field, then the Filters and Sort buttons (the sort label is hidden below `md`). */
function CatalogueToolbarSkeleton() {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Skeleton className="h-10 w-full flex-1 rounded-md" />
      <div className="flex gap-2">
        <Skeleton className="h-10 w-[5.5rem] rounded-md" />
        <Skeleton className="h-10 w-[4.25rem] rounded-md md:w-40" />
      </div>
    </div>
  );
}

/** Toolbar, facet chips, result count and grid together, for the page-level
 *  Suspense fallback and `loading.tsx`. */
export function CatalogueBrowserSkeleton() {
  return (
    <div
      className="flex flex-col gap-5"
      role="status"
      aria-busy="true"
      aria-label="Loading catalogue"
    >
      <CatalogueToolbarSkeleton />
      <div className="-mx-1 flex gap-2 overflow-hidden px-1 pb-1">
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton key={index} className="h-8 w-24 shrink-0 rounded-full" />
        ))}
      </div>
      <Skeleton className="h-5 w-28" />
      <CatalogueSkeleton />
    </div>
  );
}
