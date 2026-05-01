import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Badge } from "@/app/components/ui/Badge";
import { Card } from "@/app/components/ui/Card";
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

      <header>
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
              <input
                name="fullName"
                defaultValue={user.fullName ?? ""}
                className="h-11 w-full rounded-md bg-surface-container-highest px-3 text-sm text-on-surface outline-none ring-primary/20 focus:ring-2"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                Phone
              </span>
              <input
                name="phone"
                defaultValue={user.phone ?? ""}
                className="h-11 w-full rounded-md bg-surface-container-highest px-3 text-sm text-on-surface outline-none ring-primary/20 focus:ring-2"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                Status
              </span>
              <select
                name="status"
                defaultValue={user.status}
                className="h-11 w-full rounded-md bg-surface-container-highest px-3 text-sm font-semibold text-on-surface outline-none ring-primary/20 focus:ring-2"
              >
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
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
                  className="inline-flex items-center gap-2 rounded-full border border-outline-variant/20 bg-surface-container-highest px-3 py-2 text-sm font-semibold text-on-surface"
                >
                  <input
                    type="checkbox"
                    name="roles"
                    value={role.id}
                    defaultChecked={user.roles.includes(role.key)}
                    className="accent-primary"
                  />
                  {role.name}
                </label>
              ))}
            </div>
          </fieldset>

          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary-container px-6 text-sm font-bold text-on-primary-container"
          >
            <ShieldCheck size={16} />
            Save user
          </button>
        </form>
      </Card>

      <Card elevation="low" radius="md" className="p-6">
        <h2 className="text-xl font-bold text-on-surface">Permission overrides</h2>
        <form
          action={setPermissionOverrideAction}
          className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_140px_auto]"
        >
          <input type="hidden" name="userId" value={user.id} />
          <select
            name="permissionId"
            className="h-11 w-full rounded-md bg-surface-container-highest px-3 text-sm text-on-surface outline-none ring-primary/20 focus:ring-2"
          >
            {permissions.map((permission) => (
              <option key={permission.id} value={permission.id}>
                {permission.key}
              </option>
            ))}
          </select>
          <select
            name="mode"
            className="h-11 w-full rounded-md bg-surface-container-highest px-3 text-sm font-semibold text-on-surface outline-none ring-primary/20 focus:ring-2"
          >
            <option value="grant">Grant</option>
            <option value="deny">Deny</option>
            <option value="clear">Clear</option>
          </select>
          <button className="h-11 rounded-full border border-outline-variant/25 px-5 text-sm font-bold text-primary transition-colors hover:bg-surface-container-highest">
            Apply
          </button>
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
