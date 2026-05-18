import { AppPageHeader } from "@/app/components/app/AppPageHeader";
import { Badge } from "@/app/components/ui/Badge";
import { FilterBar } from "@/app/components/ui/FilterBar";
import {
  DataTableShell,
  tableCellClasses,
  tableClasses,
  tableHeadClasses,
  tableHeaderCellClasses,
  tableRowClasses,
} from "@/app/components/ui/DataTable";
import { formatDuration } from "@/lib/show-domain";
import { listCatalogueProducts } from "@/lib/admin.server";
import { ProductFormDialog } from "./ProductFormDialog";
import { ProductRowActions } from "./ProductRowActions";

type PageProps = {
  searchParams: Promise<{
    q?: string;
    manufacturer?: string;
    type?: string;
    duration_min?: string;
    duration_max?: string;
  }>;
};

export default async function AdminCataloguePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = (params.q ?? "").trim().toLowerCase();
  const manufacturerFilter = params.manufacturer;
  const typeFilter = params.type;
  const minDuration = params.duration_min ? Number(params.duration_min) : null;
  const maxDuration = params.duration_max ? Number(params.duration_max) : null;

  const products = await listCatalogueProducts();

  const manufacturerOptions = Array.from(
    new Set(products.map((p) => p.manufacturer).filter((v): v is string => Boolean(v))),
  )
    .sort()
    .map((v) => ({ value: v, label: v }));

  const typeOptions = Array.from(
    new Set(products.map((p) => p.fireworkType).filter((v): v is string => Boolean(v))),
  )
    .sort()
    .map((v) => ({ value: v, label: v }));

  const filtered = products.filter((p) => {
    const text = [p.partNumber, p.name, p.manufacturer, p.fireworkType]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesQuery = !query || text.includes(query);
    const matchesManufacturer = !manufacturerFilter || p.manufacturer === manufacturerFilter;
    const matchesType = !typeFilter || p.fireworkType === typeFilter;
    const d = p.durationSeconds;
    const matchesMin = minDuration == null || (d != null && d >= minDuration);
    const matchesMax = maxDuration == null || (d != null && d <= maxDuration);
    return matchesQuery && matchesManufacturer && matchesType && matchesMin && matchesMax;
  });

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <AppPageHeader title="Catalogue" description="Browse and edit catalogue products." />
        <ProductFormDialog />
      </div>

      <FilterBar
        searchPlaceholder="Search part #, name, manufacturer…"
        filters={[
          {
            key: "manufacturer",
            label: "Manufacturer",
            type: "select",
            options: manufacturerOptions,
          },
          {
            key: "type",
            label: "Type",
            type: "select",
            options: typeOptions,
          },
          {
            key: "duration",
            label: "Duration",
            type: "range",
            unit: "s",
          },
        ]}
      />

      <DataTableShell
        caption={
          <span className="text-sm font-medium text-[color:var(--color-content-default)]">
            {filtered.length} product{filtered.length === 1 ? "" : "s"}
          </span>
        }
      >
        <table className={tableClasses("min-w-[960px]")}>
          <thead className={tableHeadClasses()}>
            <tr>
              <th className={tableHeaderCellClasses("px-5 py-3")}>Part</th>
              <th className={tableHeaderCellClasses("px-5 py-3")}>Product</th>
              <th className={tableHeaderCellClasses("px-5 py-3")}>Manufacturer</th>
              <th className={tableHeaderCellClasses("px-5 py-3")}>Type</th>
              <th className={tableHeaderCellClasses("px-5 py-3")}>Duration</th>
              <th className={tableHeaderCellClasses("px-5 py-3 text-right")}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((product) => (
              <tr key={product.id} className={tableRowClasses()}>
                <td className={tableCellClasses("px-5 py-4 font-mono text-xs tabular-nums text-[color:var(--color-content-subtle)]")}>
                  {product.partNumber}
                </td>
                <td className={tableCellClasses("px-5 py-4")}>
                  <div className="font-medium text-[color:var(--color-content-emphasis)]">{product.name}</div>
                  {product.fireworkType ? (
                    <div className="mt-1">
                      <Badge solid tone="neutral">
                        {product.fireworkType}
                      </Badge>
                    </div>
                  ) : null}
                </td>
                <td className={tableCellClasses("px-5 py-4 text-[color:var(--color-content-subtle)]")}>
                  {product.manufacturer || "—"}
                </td>
                <td className={tableCellClasses("px-5 py-4 text-[color:var(--color-content-subtle)]")}>
                  {product.fireworkType || "—"}
                </td>
                <td className={tableCellClasses("px-5 py-4 font-mono text-xs tabular-nums text-[color:var(--color-content-subtle)]")}>
                  {formatDuration(product.durationSeconds)}
                </td>
                <td className={tableCellClasses("px-5 py-4 text-right")}>
                  <ProductRowActions
                    product={{
                      id: product.id,
                      partNumber: product.partNumber,
                      name: product.name,
                      manufacturer: product.manufacturer ?? undefined,
                      fireworkType: product.fireworkType ?? undefined,
                      durationSeconds: product.durationSeconds,
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>
    </div>
  );
}
