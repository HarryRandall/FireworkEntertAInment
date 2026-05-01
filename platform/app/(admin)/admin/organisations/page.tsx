import {
  createOrganisationAction,
  deleteOrganisationAction,
  updateOrganisationAction,
} from "@/app/actions/platform-admin";
import { Badge } from "@/app/components/ui/Badge";
import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { Input, Select } from "@/app/components/ui/Input";
import { listOrganisations } from "@/lib/platform.server";

const TYPE_OPTIONS = [
  { value: "customer", label: "Customer" },
  { value: "supplier", label: "Supplier" },
  { value: "internal", label: "Internal" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "archived", label: "Archived" },
];

export default async function AdminOrganisationsPage() {
  const organisations = await listOrganisations();

  return (
    <div className="space-y-6">
      <header className="border-b border-outline-variant/55 pb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
          Organisations
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-on-surface">
          Workspace foundation
        </h1>
      </header>

      <Card elevation="high" radius="md" className="p-5">
        <form
          action={createOrganisationAction}
          className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px_180px_auto]"
        >
          <Input name="name" placeholder="Organisation name" required />
          <Select name="type" defaultValue="customer">
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          <Select name="status" defaultValue="active">
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          <Button type="submit" size="sm">
            Create
          </Button>
        </form>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {organisations.map((org) => (
          <Card key={org.id} elevation="low" radius="md" className="p-5">
            <form action={updateOrganisationAction} className="space-y-4">
              <input type="hidden" name="id" value={org.id} />
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="truncate text-sm text-on-surface-variant">
                    {org.slug}
                  </p>
                  <Input
                    name="name"
                    defaultValue={org.name}
                    className="text-base font-bold"
                  />
                </div>
                <Badge tone={org.status === "active" ? "success" : "neutral"}>
                  {org.status}
                </Badge>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
                <Select name="type" defaultValue={org.type} className="h-10">
                  {TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
                <Select name="status" defaultValue={org.status} className="h-10">
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
                <Button type="submit" variant="secondary" size="sm">
                  Save
                </Button>
                <Button
                  type="submit"
                  formAction={deleteOrganisationAction}
                  variant="destructive"
                  size="sm"
                >
                  Delete
                </Button>
              </div>
            </form>
          </Card>
        ))}
      </div>
    </div>
  );
}
