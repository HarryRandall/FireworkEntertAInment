/** Server boundary for the admin effects catalogue. */
import { loadEffectRows } from '@/lib/catalogue/loaders';
import { CatalogueGrid } from '../_components/catalogue-grid';

/** Loads authorised catalogue records into the shared sortable grid. */
export default async function Page() {
  const rows = await loadEffectRows();
  return (
    <div className="grid min-w-0 gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Effects</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Reusable firework designs and seeded templates.
        </p>
      </header>
      <CatalogueGrid rows={rows} label="Effects" />
    </div>
  );
}
