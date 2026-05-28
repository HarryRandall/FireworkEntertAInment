import { Skeleton } from '@/app/components/ui/Feedback';

export default function AdminFireworkEditorLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8">
      <div className="space-y-3">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
