/** Loading skeleton for the admin fireworks list. */

import { FireworkBrowseGridSkeleton } from '@/components/catalogue/FireworkBrowseCard';
import { FilterSkeleton } from '@/components/shell/RouteSkeletons';

export default function AdminFireworksLoading() {
  return (
    <div
      className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-8"
      aria-label="Loading fireworks"
    >
      <FilterSkeleton
        searchPlaceholder="Search fireworks or effects..."
        actionLabel="New firework"
      />
      <FireworkBrowseGridSkeleton count={8} />
    </div>
  );
}
