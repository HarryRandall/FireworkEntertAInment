import {
  createSupplierAction,
  deleteSupplierAction,
  updateSupplierAction,
} from "@/app/actions/platform-admin";
import { Badge } from "@/app/components/ui/Badge";
import { Card } from "@/app/components/ui/Card";
import { listSuppliers } from "@/lib/platform.server";

export default async function AdminSuppliersPage() {
  const suppliers = await listSuppliers();

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
          Suppliers
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-on-surface">
          Supplier records
        </h1>
      </header>

      <Card elevation="high" radius="md" className="p-5">
        <form action={createSupplierAction} className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_220px_160px_1fr_150px_auto]">
          <input name="name" placeholder="Supplier name" className="h-11 rounded-md bg-surface-container-highest px-3 text-sm outline-none ring-primary/20 focus:ring-2" required />
          <input name="contactEmail" placeholder="Contact email" className="h-11 rounded-md bg-surface-container-highest px-3 text-sm outline-none ring-primary/20 focus:ring-2" />
          <input name="phone" placeholder="Phone" className="h-11 rounded-md bg-surface-container-highest px-3 text-sm outline-none ring-primary/20 focus:ring-2" />
          <input name="websiteUrl" placeholder="Website URL" className="h-11 rounded-md bg-surface-container-highest px-3 text-sm outline-none ring-primary/20 focus:ring-2" />
          <select name="status" defaultValue="draft" className="h-11 rounded-md bg-surface-container-highest px-3 text-sm font-semibold outline-none ring-primary/20 focus:ring-2">
            <option value="draft">Draft</option>
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
        {suppliers.map((supplier) => (
          <Card key={supplier.id} elevation="low" radius="md" className="p-5">
            <form action={updateSupplierAction} className="space-y-4">
              <input type="hidden" name="id" value={supplier.id} />
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <input name="name" defaultValue={supplier.name} className="h-11 w-full rounded-md bg-surface-container-highest px-3 text-lg font-bold text-on-surface outline-none ring-primary/20 focus:ring-2" />
                  <input name="contactEmail" defaultValue={supplier.contactEmail ?? ""} placeholder="Contact email" className="mt-3 h-10 w-full rounded-md bg-surface-container-highest px-3 text-sm text-on-surface outline-none ring-primary/20 focus:ring-2" />
                </div>
                <Badge tone={supplier.status === "active" ? "success" : "neutral"}>
                  {supplier.status}
                </Badge>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input name="phone" defaultValue={supplier.phone ?? ""} placeholder="Phone" className="h-10 rounded-md bg-surface-container-highest px-3 text-sm outline-none ring-primary/20 focus:ring-2" />
                <input name="websiteUrl" defaultValue={supplier.websiteUrl ?? ""} placeholder="Website URL" className="h-10 rounded-md bg-surface-container-highest px-3 text-sm outline-none ring-primary/20 focus:ring-2" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto]">
                <select name="status" defaultValue={supplier.status} className="h-10 rounded-md bg-surface-container-highest px-3 text-sm font-semibold outline-none ring-primary/20 focus:ring-2">
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="archived">Archived</option>
                </select>
                <button type="submit" className="h-10 rounded-full border border-outline-variant/25 px-4 text-sm font-bold text-primary">
                  Save
                </button>
                <button formAction={deleteSupplierAction} className="h-10 rounded-full border border-error/30 px-4 text-sm font-bold text-error">
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
