/** Loading skeleton for the admin firework editor. */

import { AdminFireworkEditorSkeleton } from '@/app/components/app/RouteSkeletons';

export default function AdminFireworkEditorLoading() {
  return (
    <div className="-mx-6 -my-6 flex h-[calc(100svh-3.5rem)] min-h-0 flex-1 sm:-mx-8 md:h-[calc(100svh-4.5rem)] lg:-mx-10">
      <AdminFireworkEditorSkeleton />
    </div>
  );
}
