/** Loading fallback for `/library`; keeps the stable header chrome visible. */

import { LibraryCardsSkeleton } from '@/app/components/app/RouteSkeletons';

export default function LibraryLoading() {
  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4">
      <header>
        <h1 className="text-foreground text-2xl font-bold tracking-tight">Explore shows</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
          Preview published show templates and choose one as a starting point for your own plan.
        </p>
      </header>
      <LibraryCardsSkeleton />
    </div>
  );
}
