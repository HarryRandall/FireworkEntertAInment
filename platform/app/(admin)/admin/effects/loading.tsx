/** Loading skeleton for the admin effects list. */

import { AdminTableRouteSkeleton } from '@/app/components/app/RouteSkeletons';
export default function AdminEffectsLoading() {
  return (
    <AdminTableRouteSkeleton
      searchPlaceholder="Search name, slug, description..."
      headers={['Effect', 'Pattern', 'Source', 'Variants', 'Updated', '']}
      tableClassName="min-w-[820px]"
      rows={12}
      hasAction
      ariaLabel="Loading effects"
    />
  );
}
