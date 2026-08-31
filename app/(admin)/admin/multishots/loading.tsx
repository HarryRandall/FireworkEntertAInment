/** Loading skeleton for the admin multishots list. */

import { FireworkBrowseGridSkeleton } from '@/components/catalogue/FireworkBrowseCard';
import { FilterSkeleton } from '@/components/shell/RouteSkeletons';

export default function AdminMultishotsLoading() {
  return (
    <div
      className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-8"
      aria-label="Loading multishots"
    >
      <FilterSkeleton searchPlaceholder="Search multishot..." actionLabel="New multishot" />
      <FireworkBrowseGridSkeleton count={8} />
    </div>
  );
}
