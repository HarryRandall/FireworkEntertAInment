/** Loading skeleton for the admin effects list. */

import { Plus } from 'lucide-react';
import { FireworkBrowseGridSkeleton } from '@/app/components/app/FireworkBrowseCard';
import { FilterSkeleton } from '@/app/components/app/RouteSkeletons';
import { Button } from '@/app/components/ui/Button';

export default function AdminEffectsLoading() {
  return (
    <div
      className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-5"
      aria-label="Loading effects"
    >
      <div className="flex items-center justify-between gap-3">
        <div
          className="border-border bg-background inline-flex h-10 shrink-0 items-center rounded-lg border p-1 shadow-xs"
          aria-label="Effects view"
        >
          <span className="bg-muted text-foreground inline-flex h-8 items-center rounded-md px-3 text-sm font-medium">
            Effects
          </span>
          <span className="text-muted-foreground inline-flex h-8 items-center rounded-md px-3 text-sm font-medium">
            Style defaults
          </span>
        </div>
        <Button variant="secondary" size="md" disabled className="pointer-events-none">
          <Plus size={16} />
          New custom effect
        </Button>
      </div>

      <FilterSkeleton searchPlaceholder="Search effects..." />
      <FireworkBrowseGridSkeleton count={8} />
    </div>
  );
}
