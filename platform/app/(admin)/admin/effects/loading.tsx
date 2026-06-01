/** Loading skeleton for the admin effects list. */

import { AdminTableRouteSkeleton } from '@/app/components/app/RouteSkeletons';
export default function AdminEffectsLoading() {
  return (
    <AdminTableRouteSkeleton
      title="Effects"
      description="Colourless base patterns used by firework variants."
      searchPlaceholder="Search name, slug, description..."
      headers={['Preview', 'Effect', 'Family', 'Pattern', 'Source', 'Variants', 'Updated', 'Open']}
      tableClassName="min-w-[1080px]"
      rows={12}
      ariaLabel="Loading effects"
    />
  );
}
