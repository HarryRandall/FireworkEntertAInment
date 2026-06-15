/** Loading skeleton for the admin fireworks list. */

import { AdminTableRouteSkeleton } from '@/app/components/app/RouteSkeletons';
export default function AdminFireworksLoading() {
  return (
    <AdminTableRouteSkeleton
      searchPlaceholder="Search firework, effect, colour..."
      headers={['Preview', 'Firework', 'Base effect', 'Colour', 'Calibre', 'Duration', 'Open']}
      tableClassName="min-w-[960px]"
      rows={8}
      ariaLabel="Loading fireworks"
    />
  );
}
