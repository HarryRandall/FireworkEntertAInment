/** Loading fallback for `/library`; keeps the stable header chrome visible. */

import { LibraryCardsSkeleton } from '@/app/components/app/RouteSkeletons';

export default function LibraryLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <header>
        <h1 className="text-foreground text-2xl font-bold tracking-tight">Explore shows</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
          Preview complete, ready-to-use firework shows and choose one as the starting point for
          your own display.
        </p>
      </header>
      <LibraryCardsSkeleton />
    </div>
  );
}
