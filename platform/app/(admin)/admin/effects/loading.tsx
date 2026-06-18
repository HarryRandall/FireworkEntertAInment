/** Loading skeleton for the admin effects list. */

import { AdminTableRouteSkeleton } from '@/app/components/app/RouteSkeletons';
export default function AdminEffectsLoading() {
  return (
    <AdminTableRouteSkeleton
      searchPlaceholder="Search name, slug, description..."
      headers={['Effect', 'Family', 'Pattern', 'Source', 'Variants', 'Updated', '']}
      tableClassName="min-w-[920px]"
      rows={12}
      hasAction
      ariaLabel="Loading effects"
    />
  );
}
