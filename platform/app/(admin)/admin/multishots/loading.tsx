/** Loading skeleton for the admin multishots list. */

import { AdminTableRouteSkeleton } from '@/app/components/app/RouteSkeletons';

export default function AdminMultishotsLoading() {
  return (
    <AdminTableRouteSkeleton
      searchPlaceholder="Search multishot..."
      headers={['Preview', 'Multishot', 'Shots', 'Duration', 'Open']}
      tableClassName="min-w-[820px]"
      rows={8}
      ariaLabel="Loading multishots"
    />
  );
}
