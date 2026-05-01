import {
  createCatalogueProductAction,
  deleteCatalogueProductAction,
} from "@/app/actions/platform-admin";
import { Badge } from "@/app/components/ui/Badge";
import { Card } from "@/app/components/ui/Card";
import {
  DataTableShell,
  tableCellClasses,
  tableClasses,
  tableHeadClasses,
  tableHeaderCellClasses,
  tableRowClasses,
} from "@/app/components/ui/DataTable";
import { formatDuration } from "@/lib/shows";
import { listCatalogueProducts } from "@/lib/platform.server";

export default async function AdminCataloguePage() {
  const products = await listCatalogueProducts();

  return (
    <div className="space-y-6">
      <header className="border-b border-outline-variant/55 pb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
          Catalogue
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-on-surface">
          Normalized products
        </h1>
      </header>

      <Card elevation="high" radius="md" className="p-5">
        <form action={createCatalogueProductAction} className="grid grid-cols-1 gap-3 lg:grid-cols-[140px_1fr_180px_160px_160px_120px_auto]">
          <input name="partNumber" placeholder="Part #" className="h-11 rounded-md bg-surface-container-highest px-3 text-sm outline-none ring-primary/20 focus:ring-2" required />
          <input name="name" placeholder="Product name" className="h-11 rounded-md bg-surface-container-highest px-3 text-sm outline-none ring-primary/20 focus:ring-2" required />
          <input name="manufacturer" placeholder="Manufacturer" className="h-11 rounded-md bg-surface-container-highest px-3 text-sm outline-none ring-primary/20 focus:ring-2" />
          <input name="category" placeholder="Category" className="h-11 rounded-md bg-surface-container-highest px-3 text-sm outline-none ring-primary/20 focus:ring-2" />
          <input name="fireworkType" placeholder="Type" className="h-11 rounded-md bg-surface-container-highest px-3 text-sm outline-none ring-primary/20 focus:ring-2" />
          <input name="durationSeconds" type="number" min="0" step="0.1" placeholder="Seconds" className="h-11 rounded-md bg-surface-container-highest px-3 text-sm outline-none ring-primary/20 focus:ring-2" />
          <button type="submit" className="h-11 rounded-full bg-primary-container px-5 text-sm font-bold text-on-primary-container">
            Add
          </button>
        </form>
      </Card>

      <DataTableShell caption={`${products.length} product${products.length === 1 ? "" : "s"}`}>
        <table className={tableClasses("min-w-[1080px]")}>
          <thead className={tableHeadClasses()}>
            <tr>
              <th className={tableHeaderCellClasses()}>Part</th>
              <th className={tableHeaderCellClasses()}>Product</th>
              <th className={tableHeaderCellClasses()}>Manufacturer</th>
              <th className={tableHeaderCellClasses()}>Category</th>
              <th className={tableHeaderCellClasses()}>Type</th>
              <th className={tableHeaderCellClasses()}>Duration</th>
              <th className={tableHeaderCellClasses("text-right")}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className={tableRowClasses()}>
                <td className={tableCellClasses("font-mono text-xs text-tertiary tabular-nums")}>
                  {product.partNumber}
                </td>
                <td className={tableCellClasses()}>
                  <div className="font-semibold text-on-surface">{product.name}</div>
                  <div className="mt-1">
                    <Badge tone="neutral">{product.fireworkType || product.category || "Unsorted"}</Badge>
                  </div>
                </td>
                <td className={tableCellClasses("text-on-surface-variant")}>
                  {product.manufacturer || "—"}
                </td>
                <td className={tableCellClasses("text-on-surface-variant")}>
                  {product.category || "—"}
                </td>
                <td className={tableCellClasses("text-on-surface-variant")}>
                  {product.fireworkType || "—"}
                </td>
                <td className={tableCellClasses("font-mono text-xs text-on-surface-variant tabular-nums")}>
                  {formatDuration(product.durationSeconds)}
                </td>
                <td className={tableCellClasses("text-right")}>
                  <form action={deleteCatalogueProductAction} className="inline-flex items-center gap-2">
                    <input type="hidden" name="id" value={product.id} />
                    <button
                      type="submit"
                      className="h-9 rounded-full border border-error/35 px-4 text-xs font-bold text-error transition-colors hover:bg-error/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/45"
                    >
                      Delete
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>
    </div>
  );
}
