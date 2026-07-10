/** Loading skeleton for the `/library` route. */

import { LibraryCardsSkeleton } from '@/app/components/app/RouteSkeletons';

export default function LibraryLoading() {
  return (
    <div className="space-y-4" aria-label="Loading show library">
      <header>
        <h1 className="text-on-surface text-2xl font-bold tracking-tight">Explore shows</h1>
        <p className="text-on-surface-variant mt-1 max-w-2xl text-sm leading-relaxed">
          Preview complete, ready-to-use firework shows and choose one as the starting point for
          your own display.
        </p>
      </header>
      <LibraryCardsSkeleton />
    </div>
  );
}
