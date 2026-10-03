/** Server boundary for the admin multishots catalogue. */
import { loadProductRows } from '@/lib/catalogue/loaders';
import { CatalogueGrid } from '../_components/catalogue-grid';

/** Loads authorised catalogue records into the shared sortable grid. */
export default async function Page() {
  const rows = await loadProductRows(true);
  return (
    <div className="grid min-w-0 gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Multishots</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Cake products and their composition versions.
        </p>
      </header>
      <CatalogueGrid rows={rows} label="Multishots" />
    </div>
  );
}
