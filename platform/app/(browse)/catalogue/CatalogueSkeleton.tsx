/** Shared catalogue skeletons used by the page's Suspense fallback and `loading.tsx`. */

import { FireworkBrowseGridSkeleton } from '@/app/components/app/FireworkBrowseCard';
import { Skeleton } from '@/app/components/ui/Feedback';

export const CATALOGUE_PAGE_SIZE = 15;

export function CatalogueSkeleton() {
  return <FireworkBrowseGridSkeleton count={CATALOGUE_PAGE_SIZE} />;
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
