import {
  createSupplierAction,
  deleteSupplierAction,
  updateSupplierAction,
} from "@/app/actions/platform-admin";
import { AppPageHeader } from "@/app/components/app/AppPageHeader";
import { Badge } from "@/app/components/ui/Badge";
import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { Input, Select } from "@/app/components/ui/Input";
import { listSuppliers } from "@/lib/platform.server";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "archived", label: "Archived" },
];

export default async function AdminSuppliersPage() {
  const suppliers = await listSuppliers();

  return (
    <div className="space-y-6">
      <AppPageHeader title="Supplier records" />

      <Card elevation="high" radius="md" className="p-5">
        <form
          action={createSupplierAction}
          className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_220px_160px_1fr_150px_auto]"
        >
          <Input name="name" placeholder="Supplier name" required />
          <Input name="contactEmail" placeholder="Contact email" />
          <Input name="phone" placeholder="Phone" />
          <Input name="websiteUrl" placeholder="Website URL" />
          <Select name="status" defaultValue="draft">
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
        {suppliers.map((supplier) => (
          <Card key={supplier.id} elevation="low" radius="md" className="p-5">
            <form action={updateSupplierAction} className="space-y-4">
              <input type="hidden" name="id" value={supplier.id} />
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-3">
                  <Input
                    name="name"
                    defaultValue={supplier.name}
                    className="text-base font-bold"
                  />
                  <Input
                    name="contactEmail"
                    defaultValue={supplier.contactEmail ?? ""}
                    placeholder="Contact email"
                    className="h-10"
                  />
                </div>
                <Badge
                  tone={supplier.status === "active" ? "success" : "neutral"}
                >
                  {supplier.status}
                </Badge>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  name="phone"
                  defaultValue={supplier.phone ?? ""}
                  placeholder="Phone"
                  className="h-10"
                />
                <Input
                  name="websiteUrl"
                  defaultValue={supplier.websiteUrl ?? ""}
                  placeholder="Website URL"
                  className="h-10"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto]">
                <Select
                  name="status"
                  defaultValue={supplier.status}
                  className="h-10"
                >
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
                  formAction={deleteSupplierAction}
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
