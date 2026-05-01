import {
  createOrganisationAction,
  deleteOrganisationAction,
  updateOrganisationAction,
} from "@/app/actions/platform-admin";
import { Badge } from "@/app/components/ui/Badge";
import { Card } from "@/app/components/ui/Card";
import { listOrganisations } from "@/lib/platform.server";

export default async function AdminOrganisationsPage() {
  const organisations = await listOrganisations();

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
          Organisations
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-on-surface">
          Workspace foundation
        </h1>
      </header>

      <Card elevation="high" radius="md" className="p-5">
        <form action={createOrganisationAction} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px_180px_auto]">
          <input name="name" placeholder="Organisation name" className="h-11 rounded-md bg-surface-container-highest px-3 text-sm outline-none ring-primary/20 focus:ring-2" required />
          <select name="type" defaultValue="customer" className="h-11 rounded-md bg-surface-container-highest px-3 text-sm font-semibold outline-none ring-primary/20 focus:ring-2">
            <option value="customer">Customer</option>
            <option value="supplier">Supplier</option>
            <option value="internal">Internal</option>
          </select>
          <select name="status" defaultValue="active" className="h-11 rounded-md bg-surface-container-highest px-3 text-sm font-semibold outline-none ring-primary/20 focus:ring-2">
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="archived">Archived</option>
          </select>
          <button type="submit" className="h-11 rounded-full bg-primary-container px-5 text-sm font-bold text-on-primary-container">
            Create
          </button>
        </form>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {organisations.map((org) => (
          <Card key={org.id} elevation="low" radius="md" className="p-5">
            <form action={updateOrganisationAction} className="space-y-4">
              <input type="hidden" name="id" value={org.id} />
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-on-surface-variant">{org.slug}</p>
                  <input name="name" defaultValue={org.name} className="mt-2 h-11 w-full rounded-md bg-surface-container-highest px-3 text-lg font-bold text-on-surface outline-none ring-primary/20 focus:ring-2" />
                </div>
                <Badge tone={org.status === "active" ? "success" : "neutral"}>
                  {org.status}
                </Badge>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
                <select name="type" defaultValue={org.type} className="h-10 rounded-md bg-surface-container-highest px-3 text-sm font-semibold outline-none ring-primary/20 focus:ring-2">
                  <option value="customer">Customer</option>
                  <option value="supplier">Supplier</option>
                  <option value="internal">Internal</option>
                </select>
                <select name="status" defaultValue={org.status} className="h-10 rounded-md bg-surface-container-highest px-3 text-sm font-semibold outline-none ring-primary/20 focus:ring-2">
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="archived">Archived</option>
                </select>
                <button type="submit" className="h-10 rounded-full border border-outline-variant/25 px-4 text-sm font-bold text-primary">
                  Save
                </button>
                <button formAction={deleteOrganisationAction} className="h-10 rounded-full border border-error/30 px-4 text-sm font-bold text-error">
                  Delete
                </button>
              </div>
            </form>
          </Card>
        ))}
      </div>
    </div>
  );
}
