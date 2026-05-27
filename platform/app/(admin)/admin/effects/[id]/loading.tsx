/** Loading skeleton for the admin effect editor. */

import { Skeleton } from '@/app/components/ui/Feedback';

export default function AdminEffectEditorLoading() {
  return (
    <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(420px,0.9fr)_minmax(0,1.1fr)]">
      <div className="space-y-6">
        <Skeleton className="h-[520px] rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <div className="space-y-6">
        <Skeleton className="h-[720px] rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}
