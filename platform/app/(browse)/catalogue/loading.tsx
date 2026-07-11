/** Loading fallback for `/catalogue`; keeps the stable header chrome visible. */

import { CatalogueSkeleton, CatalogueToolbarSkeleton } from './CatalogueSkeleton';

export default function CatalogueLoading() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <header>
        <h1 className="text-foreground text-2xl font-bold tracking-tight">Firework catalogue</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
          Browse the products and effects available for ShowCrafter timelines.
        </p>
      </header>
      <CatalogueToolbarSkeleton />
      <CatalogueSkeleton />
    </div>
  );
}
