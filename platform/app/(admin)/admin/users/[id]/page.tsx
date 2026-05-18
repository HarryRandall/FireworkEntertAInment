import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, UserRound } from "lucide-react";
import { ListSkeleton } from "@/app/components/app/RouteSkeletons";
import { Badge } from "@/app/components/ui/Badge";
import { Card } from "@/app/components/ui/Card";
import { StatTile } from "@/app/components/ui/StatTile";
import {
  getAdminUserById,
  getUserActivity,
  listPermissions,
  listRoles,
} from "@/lib/admin.server";
import type { AdminUser, ProfileStatus, RoleKey } from "@/lib/admin.types";
import { UserActivityChart } from "./UserActivityChart";
import { UserHeaderActions } from "./UserHeaderActions";
import { UserRoleSelect } from "./UserRoleSelect";
import { PermissionOverrideRow } from "./PermissionOverrideRow";

type PageProps = { params: Promise<{ id: string }> };

function roleTone(role: RoleKey) {
  if (role === "admin") return "violet" as const;
  if (role === "supplier") return "sky" as const;
  return "neutral" as const;
}

function statusTone(status: ProfileStatus) {
  if (status === "active") return "success" as const;
  if (status === "suspended") return "danger" as const;
  return "amber-soft" as const;
}

function initialsFor(name: string | null, email: string | null) {
  const source = (name ?? email ?? "U").trim();
  return source
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default async function AdminUserDetailPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getAdminUserById(id);
  if (!user) notFound();

  const primaryRole = user.roles[0] ?? "user";

  return (
    <div className="space-y-8">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-2 text-sm font-medium text-[color:var(--color-content-subtle)] hover:text-[color:var(--color-content-emphasis)]"
      >
        <ArrowLeft size={16} />
        Back to users
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--color-bg-subtle)] text-sm font-semibold text-[color:var(--color-content-emphasis)]">
            {user.fullName || user.email ? (
              initialsFor(user.fullName, user.email)
            ) : (
              <UserRound size={20} />
            )}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-[color:var(--color-content-emphasis)]">
                {user.fullName || "Unnamed user"}
              </h1>
              <Badge solid tone={statusTone(user.status)}>{user.status}</Badge>
              <Badge solid tone={roleTone(primaryRole)}>{primaryRole}</Badge>
            </div>
            <p className="mt-1 text-sm text-[color:var(--color-content-subtle)]">
              {user.email || "No email on file"}
              {user.phone ? <span className="ml-3">{user.phone}</span> : null}
            </p>
          </div>
        </div>
        <UserHeaderActions userId={user.id} />
      </header>

      <Suspense fallback={<ListSkeleton rows={3} />}>
        <AdminUserActivity userId={user.id} />
      </Suspense>

      <Suspense fallback={<ListSkeleton rows={1} />}>
        <AdminUserRoleCard user={user} />
      </Suspense>

      <Suspense fallback={<ListSkeleton rows={6} />}>
        <AdminUserPermissionsCard user={user} />
      </Suspense>

      <p className="text-xs text-[color:var(--color-content-muted)]">
        Last updated {formatDate(user.updatedAt)}
      </p>
    </div>
  );
}

async function AdminUserActivity({ userId }: { userId: string }) {
  const activity = await getUserActivity(userId);
  return (
    <>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label="Account age"
          value={activity?.stats.accountAgeDays ?? "—"}
          unit={activity?.stats.accountAgeDays != null ? "days" : undefined}
        />
        <StatTile
          label="Last sign-in"
          value={
            activity?.stats.lastSignInAt
              ? new Date(activity.stats.lastSignInAt).toLocaleDateString()
              : "—"
          }
        />
        <StatTile label="Shows created" value={activity?.stats.totalShows ?? 0} />
        <StatTile label="Shows last 30d" value={activity?.stats.shows30dCount ?? 0} />
      </section>

      <Card elevation="low" radius="lg" className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-[color:var(--color-content-emphasis)]">
            Activity (last 30 days)
          </h2>
          <span className="text-xs text-[color:var(--color-content-subtle)]">Shows created per day</span>
        </div>
        <UserActivityChart data={activity?.shows30d ?? []} />
      </Card>
    </>
  );
}

async function AdminUserRoleCard({ user }: { user: AdminUser }) {
  const roles = await listRoles();
  const primaryRole = user.roles[0] ?? "user";
  const primaryRoleRow = roles.find((r) => r.key === primaryRole) ?? roles[0];
  return (
    <Card elevation="low" radius="lg" className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-[color:var(--color-content-emphasis)]">Role</h2>
          <p className="mt-0.5 text-xs text-[color:var(--color-content-subtle)]">
            Changes save automatically.
          </p>
        </div>
        {primaryRoleRow ? (
          <UserRoleSelect userId={user.id} roles={roles} initialRoleId={primaryRoleRow.id} />
        ) : null}
      </div>
    </Card>
  );
}

async function AdminUserPermissionsCard({ user }: { user: AdminUser }) {
  const permissions = await listPermissions();
  const overrideByPermissionId = new Map(
    user.permissionOverrides.map((o) => [o.permissionId, o.enabled ? "grant" : "deny"] as const),
  );
  return (
    <Card elevation="low" radius="lg" className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-[color:var(--color-content-emphasis)]">
            Permission overrides
          </h2>
          <p className="mt-0.5 text-xs text-[color:var(--color-content-subtle)]">
            Override role permissions per user. Defaults to inherit.
          </p>
        </div>
      </div>
      <div className="divide-y divide-[color:var(--color-border-subtle)]">
        {permissions.map((permission) => {
          const mode = (overrideByPermissionId.get(permission.id) ?? "clear") as
            | "grant"
            | "deny"
            | "clear";
          return (
            <PermissionOverrideRow
              key={permission.id}
              userId={user.id}
              permission={permission}
              initialMode={mode}
            />
          );
        })}
      </div>
    </Card>
  );
}
