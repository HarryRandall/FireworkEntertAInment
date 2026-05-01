import { Database, FileInput, Store, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/app/components/ui/Card";
import { StatTile } from "@/app/components/ui/StatTile";
import {
  listAdminUsers,
  listCatalogueProducts,
  listImportJobs,
  listSuppliers,
} from "@/lib/platform.server";

export default async function AdminOverviewPage() {
  const [users, suppliers, imports, catalogue] = await Promise.all([
    listAdminUsers(),
    listSuppliers(),
    listImportJobs(),
    listCatalogueProducts(),
  ]);

  return (
    <div className="space-y-8">
      <header className="border-b border-outline-variant/55 pb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
          Admin
        </p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-on-surface">
          Platform command centre
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
          Manage access, suppliers, catalogue data, and VDL/video import records
          from a dedicated control surface.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Users" value={users.length} />
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AdminCard
          icon={<Users size={18} strokeWidth={1.8} />}
          title="User access"
          body="Search users from a table, then open one record to update roles, profile fields, and permission overrides."
        />
        <AdminCard
          icon={<Store size={18} strokeWidth={1.8} />}
          title="Supplier foundation"
          body="Supplier records and inventory tables are ready for the stock upload workflow."
        />
        <AdminCard
          icon={<FileInput size={18} strokeWidth={1.8} />}
          title="Review-first imports"
          body="VDL, Loom, MP4, and model output records are stored before they become approved firework specs."
        />
        <AdminCard
          icon={<Database size={18} strokeWidth={1.8} />}
          title="Catalogue path"
          body="Imported sample data can be normalized into catalogue products and viewer-ready specifications."
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

function AdminCard({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Card elevation="low" radius="md" className="p-5">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <h2 className="text-lg font-bold text-on-surface">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
        {body}
      </p>
    </Card>
  );
}
