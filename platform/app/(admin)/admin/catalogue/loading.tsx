/** Loading skeleton for the admin catalogue list. */

import { AdminTableRouteSkeleton } from '@/app/components/app/RouteSkeletons';

export default function AdminCatalogueLoading() {
  return (
    <AdminTableRouteSkeleton
      title="Catalogue"
      description="Browse and edit catalogue products."
      searchPlaceholder="Search part #, name, manufacturer..."
      headers={['Part', 'Product', 'Manufacturer', 'Type', 'Duration', 'Actions']}
      rows={10}
      hasAction
      ariaLabel="Loading catalogue"
    />
  );
}
