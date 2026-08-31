/** Loading skeleton for the admin effect editor. */

import { AdminEffectEditorSkeleton } from '@/components/shell/RouteSkeletons';

export default function AdminEffectEditorLoading() {
  return (
    <div className="-mx-6 -my-6 flex h-[calc(100svh-3.5rem)] min-h-0 flex-1 sm:-mx-8 md:h-[calc(100svh-4.5rem)] lg:-mx-10">
      <AdminEffectEditorSkeleton />
    </div>
  );
}
