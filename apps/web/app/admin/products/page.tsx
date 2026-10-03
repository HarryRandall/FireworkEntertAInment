/** Server boundary for the admin products catalogue. */
import { loadProductRows } from '@/lib/catalogue/loaders';
import { CatalogueGrid } from '../_components/catalogue-grid';

/** Loads authorised catalogue records into the shared sortable grid. */
export default async function Page() {
  const rows = await loadProductRows();
  return (
    <div className="grid min-w-0 gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Products</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Single items, cakes and selection packs in the catalogue.
        </p>
      </header>
      <CatalogueGrid rows={rows} label="Products" />
    </div>
  );
}
