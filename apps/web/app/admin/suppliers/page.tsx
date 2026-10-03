/** Server boundary for the admin suppliers catalogue. */
import { loadSupplierRows } from '@/lib/catalogue/loaders';
import { CatalogueGrid } from '../_components/catalogue-grid';

/** Loads authorised catalogue records into the shared sortable grid. */
export default async function Page() {
  const rows = await loadSupplierRows();
  return (
    <div className="grid min-w-0 gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Suppliers</h1>
        <p className="text-muted-foreground mt-2 text-sm">Supplier contacts and market coverage.</p>
      </header>
      <CatalogueGrid rows={rows} label="Suppliers" />
    </div>
  );
}
