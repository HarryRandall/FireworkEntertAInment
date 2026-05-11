import { AppPageHeader } from "@/app/components/app/AppPageHeader";
import { InfoTooltip } from "@/app/components/ui/InfoTooltip";
import { Card } from "@/app/components/ui/Card";
import { StatTile } from "@/app/components/ui/StatTile";
import {
  listAdminUsers,
  listCatalogueProducts,
  listImportJobs,
  listSuppliers,
} from "@/lib/admin.server";

export default async function AdminOverviewPage() {
  const [users, suppliers, imports, catalogue] = await Promise.all([
    listAdminUsers(),
    listSuppliers(),
    listImportJobs(),
    listCatalogueProducts(),
  ]);

  return (
    <div className="space-y-8">
      <AppPageHeader
        title="Platform command centre"
        description="Manage access, suppliers, catalogue data, and VDL/video import records from a dedicated control surface."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Users"
          labelAddon={<InfoTooltip text="This is the total users we have." />}
          value={users.length}
        />
        <StatTile label="Suppliers" value={suppliers.length} />
        <StatTile label="Imports" value={imports.length} />
        <StatTile label="Catalogue products" value={catalogue.length} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ActivityCard
          title="Platform mix"
          rows={[
            { label: "Users", value: users.length },
            { label: "Suppliers", value: suppliers.length },
            { label: "Catalogue", value: catalogue.length },
          ]}
        />
        <ActivityCard
          title="Import pipeline"
          rows={[
            { label: "Draft", value: imports.filter((job) => job.status === "draft").length },
            { label: "Needs review", value: imports.filter((job) => job.status === "needs_review").length },
            { label: "Complete", value: imports.filter((job) => job.status === "complete").length },
          ]}
        />
      </div>

    </div>
  );
}

function ActivityCard({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: number }[];
}) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <Card elevation="low" radius="md" className="p-5">
      <h2 className="text-lg font-bold text-on-surface">{title}</h2>
      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-on-surface-variant">{row.label}</span>
              <span className="font-bold tabular-nums text-on-surface">{row.value}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-container-highest">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.max((row.value / max) * 100, row.value > 0 ? 8 : 0)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
