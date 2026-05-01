import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Badge } from "@/app/components/ui/Badge";
import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { Input, Select } from "@/app/components/ui/Input";
import {
  setPermissionOverrideAction,
  updateAdminUserAction,
} from "@/app/actions/platform-admin";
import {
  getAdminUserById,
  listPermissions,
  listRoles,
} from "@/lib/platform.server";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminUserDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [user, roles, permissions] = await Promise.all([
    getAdminUserById(id),
    listRoles(),
    listPermissions(),
  ]);
  if (!user) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-2 text-sm font-bold text-primary"
      >
        <ArrowLeft size={16} />
        Back to users
      </Link>

      <header className="border-b border-outline-variant/55 pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-on-surface">
            {user.fullName || user.email || "Unnamed user"}
          </h1>
          <Badge tone={user.status === "active" ? "success" : "neutral"}>
            {user.status}
          </Badge>
        </div>
        <p className="mt-2 break-all text-sm text-on-surface-variant">
          {user.email || "No email"}
        </p>
      </header>

      <Card elevation="high" radius="md" className="p-6">
        <form action={updateAdminUserAction} className="space-y-5">
          <input type="hidden" name="userId" value={user.id} />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px_180px]">
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                Full name
              </span>
              <Input name="fullName" defaultValue={user.fullName ?? ""} />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                Phone
              </span>
              <Input name="phone" defaultValue={user.phone ?? ""} />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                Status
              </span>
              <Select name="status" defaultValue={user.status}>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </Select>
            </label>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              Roles
            </legend>
            <div className="flex flex-wrap gap-2">
              {roles.map((role) => (
                <label
                  key={role.id}
                  className="group inline-flex cursor-pointer items-center gap-2 rounded-full border border-outline/55 bg-surface px-4 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:border-primary/40 hover:text-on-surface has-[:checked]:border-primary/60 has-[:checked]:bg-primary/10 has-[:checked]:text-primary"
                >
                  <input
                    type="checkbox"
                    name="roles"
                    value={role.id}
                    defaultChecked={user.roles.includes(role.key)}
                    className="sr-only"
                  />
                  {role.name}
                </label>
              ))}
            </div>
          </fieldset>

          <Button type="submit">
            <ShieldCheck size={16} />
            Save user
          </Button>
        </form>
      </Card>

      <Card elevation="low" radius="md" className="p-6">
        <h2 className="text-xl font-bold text-on-surface">Permission overrides</h2>
        <form
          action={setPermissionOverrideAction}
          className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_140px_auto]"
        >
          <input type="hidden" name="userId" value={user.id} />
          <Select name="permissionId">
            {permissions.map((permission) => (
              <option key={permission.id} value={permission.id}>
                {permission.key}
              </option>
            ))}
          </Select>
          <Select name="mode">
            <option value="grant">Grant</option>
            <option value="deny">Deny</option>
            <option value="clear">Clear</option>
          </Select>
          <Button type="submit" variant="secondary" size="sm">
            Apply
          </Button>
        </form>

        {user.permissionOverrides.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {user.permissionOverrides.map((override) => (
              <Badge
                key={`${override.permissionId}-${override.enabled}`}
                tone={override.enabled ? "live" : "neutral"}
              >
                {override.enabled ? "Grant" : "Deny"} {override.permissionKey}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-on-surface-variant">
            No individual overrides. This user receives permissions from roles.
          </p>
        )}
      </Card>
    </div>
  );
}
