/** Loading skeleton for the admin curated show preset list. */

import { FilterSkeleton, TableSkeleton } from '@/components/shell/RouteSkeletons';
import { TABLE_PAGE_SIZE } from '@/components/design-system/TablePagination';

export default function AdminShowPresetsLoading() {
  return (
    <div
      className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-8"
      aria-label="Loading curated shows"
    >
      <FilterSkeleton searchPlaceholder="Search curated shows..." actionLabel="New draft" />
      <div className="min-h-0 flex-1 overflow-hidden">
        <TableSkeleton
          rows={TABLE_PAGE_SIZE}
          headers={['Status', 'Show', 'Featured', 'Cues', 'Duration', 'Sort', 'Updated', 'Open']}
          tableClassName="min-w-[980px]"
        />
      </div>
    </div>
  );
}
