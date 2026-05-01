import {
  createCatalogueProductAction,
  deleteCatalogueProductAction,
} from "@/app/actions/platform-admin";
import { AppPageHeader } from "@/app/components/app/AppPageHeader";
import { Badge } from "@/app/components/ui/Badge";
import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { Input } from "@/app/components/ui/Input";
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
      <AppPageHeader title="Normalized products" />

      <Card elevation="high" radius="md" className="p-5">
        <form
          action={createCatalogueProductAction}
          className="grid grid-cols-1 gap-3 lg:grid-cols-[140px_1fr_180px_160px_160px_120px_auto]"
        >
          <Input name="partNumber" placeholder="Part #" required />
          <Input name="name" placeholder="Product name" required />
          <Input name="manufacturer" placeholder="Manufacturer" />
          <Input name="category" placeholder="Category" />
          <Input name="fireworkType" placeholder="Type" />
          <Input
            name="durationSeconds"
            type="number"
            min={0}
            step={0.1}
            placeholder="Seconds"
          />
          <Button type="submit" size="sm">
            Add
          </Button>
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
                  <form
                    action={deleteCatalogueProductAction}
                    className="inline-flex items-center gap-2"
                  >
                    <input type="hidden" name="id" value={product.id} />
                    <Button type="submit" variant="destructive" size="sm">
                      Delete
                    </Button>
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
