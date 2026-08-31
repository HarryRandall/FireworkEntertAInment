/**
 * Loading fallback for the new-show wizard (`/shows/new`).
 *
 * Mirrors the wizard shell (centred heading + compact prompt panel) so
 * arriving from the home prompt or the "New show" button never flashes the
 * show-detail preview skeleton. Dimensions match the loaded step-0 panel so
 * the swap does not shift layout.
 */

import { Skeleton } from '@/app/components/ui/Feedback';

export function WizardLoading() {
  return (
    <div
      className="new-show-wizard-screen -mx-6 -my-6 flex flex-1 sm:-mx-8 lg:-mx-10"
      aria-label="Loading show wizard"
    >
      <div className="relative z-10 flex w-full flex-col px-6 pt-5 pb-6 sm:px-10">
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center py-8 sm:py-10">
          <div className="relative isolate mx-auto w-full max-w-3xl">
            <div className="prompt-hero-glow" aria-hidden />
            <div className="flex flex-col items-center">
              <Skeleton className="h-9 w-72 max-w-full sm:h-11 sm:w-96" />
              <Skeleton className="mt-3 h-4 w-64 max-w-full sm:h-5" />
            </div>
            <div className="mt-8 overflow-hidden rounded-2xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-elevated)]/55 shadow-xs backdrop-blur-md">
              <div className="h-28 p-4">
                <Skeleton className="h-4 w-56 max-w-full" />
              </div>
              <div className="px-4 pt-2 pb-3">
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="h-7 w-40 rounded-full" />
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <Skeleton className="h-9 w-28 rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
