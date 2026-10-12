/** Loading fallback for `/catalogue`; keeps the stable header chrome visible. */

import { CatalogueBrowserSkeleton } from '@/app/(browse)/catalogue/_components/CatalogueSkeleton';

export default function CatalogueLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
      <header>
        <h1 className="text-foreground text-2xl font-bold tracking-tight">Firework catalogue</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
          Hover any firework to watch it fire, or open it for the full specification, colours and
          shot sequence.
        </p>
      </header>
      <CatalogueBrowserSkeleton />
    </div>
  );
}
