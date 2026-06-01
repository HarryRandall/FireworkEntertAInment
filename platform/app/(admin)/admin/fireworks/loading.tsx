/** Loading skeleton for the admin fireworks list. */

import { AdminTableRouteSkeleton } from '@/app/components/app/RouteSkeletons';
export default function AdminFireworksLoading() {
  return (
    <AdminTableRouteSkeleton
      title="Fireworks"
      description="Product-level fireworks assembled from one or more reusable effects."
      searchPlaceholder="Search product, part number, effect..."
      headers={[
        'Preview',
        'Product',
        'Manufacturer',
        'Type',
        'Effects',
        'Calibre',
        'Shots',
        'Duration',
        'Open',
      ]}
      tableClassName="min-w-[1120px]"
      rows={8}
      ariaLabel="Loading fireworks"
    />
  );
}
