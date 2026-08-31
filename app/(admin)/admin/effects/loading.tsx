'use client';

/** Query-aware loading skeleton for the admin effects gallery. */

import { Plus } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { FireworkBrowseGridSkeleton } from '@/app/components/app/FireworkBrowseCard';
import { FilterSkeleton } from '@/app/components/app/RouteSkeletons';
import { Button } from '@/app/components/ui/Button';
import {
  ADMIN_EFFECTS_BASE_VIEW,
  adminEffectsViewDescription,
  adminEffectsViewLabel,
  parseAdminEffectsView,
} from '@/lib/admin-effects-navigation';

export default function AdminEffectsLoading() {
  const searchParams = useSearchParams();
  const view = parseAdminEffectsView(searchParams.get('view'), searchParams.get('tab'));
  const effectsActive = view === ADMIN_EFFECTS_BASE_VIEW;

  return (
    <div
      className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-5"
      aria-label="Loading effects"
    >
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Effects
          </p>
          <h1 className="text-foreground mt-1 text-2xl font-semibold tracking-tight">
            {adminEffectsViewLabel(view)}
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            {adminEffectsViewDescription(view)}
          </p>
        </div>
        <Button variant="secondary" size="md" disabled className="pointer-events-none">
          <Plus size={16} />
          {effectsActive ? 'New custom effect' : 'Add new'}
        </Button>
      </div>

      <FilterSkeleton
        searchPlaceholder={effectsActive ? 'Search base effects...' : 'Search style defaults...'}
      />
      <FireworkBrowseGridSkeleton count={8} />
    </div>
  );
}
