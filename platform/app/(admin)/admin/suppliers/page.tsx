import { Suspense } from "react";
import { AppPageHeader } from "@/app/components/app/AppPageHeader";
import { TableSkeleton } from "@/app/components/app/RouteSkeletons";
import { Badge } from "@/app/components/ui/Badge";
import { FilterBar } from "@/app/components/ui/FilterBar";
import { TABLE_PAGE_SIZE, TablePagination } from "@/app/components/ui/TablePagination";
import {
  DataTableShell,
  tableCellClasses,
  tableClasses,
  tableHeadClasses,
  tableHeaderCellClasses,
  tableRowClasses,
} from "@/app/components/ui/DataTable";
import { listSuppliers } from "@/lib/admin.server";
import { SupplierFormDialog } from "./SupplierFormDialog";
import { SupplierRowActions } from "./SupplierRowActions";

type PageProps = {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
};
type SuppliersSearchParams = Awaited<PageProps["searchParams"]>;


function statusTone(status: string) {
  switch (status) {
    case "active":
      return "success" as const;
    case "suspended":
      return "danger" as const;
    case "archived":
      return "neutral" as const;
    default:
      return "amber-soft" as const;
  }
}

export default async function AdminSuppliersPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8">
      <AppPageHeader
        title="Suppliers"
        description="Manage supplier records, contacts, and status."
        actions={<SupplierFormDialog />}
      />

      <FilterBar
        searchPlaceholder="Search name, email, phone, website…"
        filters={[
          {
            key: "status",
            label: "Status",
            type: "select",
            options: [
              { value: "draft", label: "Draft" },
              { value: "active", label: "Active" },
              { value: "suspended", label: "Suspended" },
              { value: "archived", label: "Archived" },
            ],
          },
        ]}
      />

      <Suspense
        fallback={
          <div className="min-h-0 flex-1 overflow-hidden">
            <TableSkeleton rows={TABLE_PAGE_SIZE} columns={6} />
          </div>
        }
      >
        <SuppliersTable params={params} />
      </Suspense>
    </div>
  );
}

async function SuppliersTable({ params }: { params: SuppliersSearchParams }) {
  const query = (params.q ?? "").trim().toLowerCase();
  const statusFilter = params.status;
  const requestedPage = Number(params.page ?? "1");

  const suppliers = await listSuppliers();
  const filtered = suppliers.filter((s) => {
    const text = [s.name, s.contactEmail, s.phone, s.websiteUrl].filter(Boolean).join(" ").toLowerCase();
    const matchesQuery = !query || text.includes(query);
    const matchesStatus = !statusFilter || s.status === statusFilter;
    return matchesQuery && matchesStatus;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / TABLE_PAGE_SIZE));
  const currentPage = Number.isFinite(requestedPage)
    ? Math.min(Math.max(1, requestedPage), totalPages)
    : 1;
  const pageStart = (currentPage - 1) * TABLE_PAGE_SIZE;
  const paginated = filtered.slice(pageStart, pageStart + TABLE_PAGE_SIZE);

  return (
    <>
      <DataTableShell>
        <table className={tableClasses()}>
          <thead className={tableHeadClasses()}>
            <tr>
              <th className={tableHeaderCellClasses("px-5 py-3")}>Name</th>
              <th className={tableHeaderCellClasses("px-5 py-3")}>Email</th>
              <th className={tableHeaderCellClasses("px-5 py-3")}>Phone</th>
              <th className={tableHeaderCellClasses("px-5 py-3")}>Website</th>
              <th className={tableHeaderCellClasses("px-5 py-3")}>Status</th>
              <th className={tableHeaderCellClasses("px-5 py-3 text-right")}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((s) => {
              const supplierForActions = {
                id: s.id,
                name: s.name,
                contactEmail: s.contactEmail ?? "",
                phone: s.phone ?? undefined,
                websiteUrl: s.websiteUrl ?? "",
                status: (s.status as "draft" | "active" | "suspended" | "archived") ?? "draft",
              };
              return (
                <tr key={s.id} className={tableRowClasses()}>
                  <td className={tableCellClasses("px-5 py-4 font-medium text-[color:var(--color-content-emphasis)]")}>
                    {s.name}
                  </td>
                  <td className={tableCellClasses("px-5 py-4 text-[color:var(--color-content-subtle)]")}>
                    {s.contactEmail || "—"}
                  </td>
                  <td className={tableCellClasses("px-5 py-4 font-mono text-xs tabular-nums text-[color:var(--color-content-subtle)]")}>
                    {s.phone || "—"}
                  </td>
                  <td className={tableCellClasses("px-5 py-4 text-[color:var(--color-content-subtle)]")}>
                    {s.websiteUrl ? (
                      <a
                        href={s.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline decoration-dotted underline-offset-2 hover:text-[color:var(--color-content-emphasis)]"
                      >
                        {s.websiteUrl.replace(/^https?:\/\//, "")}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className={tableCellClasses("px-5 py-4")}>
                    <Badge solid tone={statusTone(s.status)}>
                      {s.status}
                    </Badge>
                  </td>
                  <td className={tableCellClasses("px-5 py-4 text-right")}>
                    <SupplierRowActions supplier={supplierForActions} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DataTableShell>

      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        searchParams={params}
      />
    </>
  );
}
