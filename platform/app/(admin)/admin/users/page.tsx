import Link from "next/link";
import { Search, UserRound } from "lucide-react";
import { AppPageHeader } from "@/app/components/app/AppPageHeader";
import { Badge } from "@/app/components/ui/Badge";
import { Button } from "@/app/components/ui/Button";
import {
  DataTableShell,
  tableCellClasses,
  tableClasses,
  tableHeadClasses,
  tableHeaderCellClasses,
  tableRowClasses,
} from "@/app/components/ui/DataTable";
import { Card } from "@/app/components/ui/Card";
import { Input, Select } from "@/app/components/ui/Input";
import { listAdminUsers } from "@/lib/admin.server";

type PageProps = {
  searchParams: Promise<{ q?: string; role?: string; status?: string }>;
};

const ROLE_OPTIONS = [
  { value: "all", label: "All roles" },
  { value: "admin", label: "Admin" },
  { value: "supplier", label: "Supplier" },
  { value: "user", label: "User" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
];

const rowLinkClasses = "block px-5 py-4";

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = (params.q ?? "").trim().toLowerCase();
  const role = params.role ?? "all";
  const status = params.status ?? "all";
  const users = await listAdminUsers();
  const filtered = users.filter((user) => {
    const text = [user.fullName, user.email, user.phone, user.roles.join(" ")]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesQuery = !query || text.includes(query);
    const matchesRole = role === "all" || user.roles.some((userRole) => userRole === role);
    const matchesStatus = status === "all" || user.status === status;
    return matchesQuery && matchesRole && matchesStatus;
  });

  return (
    <div className="space-y-10">
      <AppPageHeader
        title="Search user records"
        description="Search, filter, and scan platform users with tokenized status and role indicators."
      />

      <div className="flex flex-col gap-8">
        <Card
          elevation="low"
          radius="lg"
          className="p-0"
        >
          <form className="grid grid-cols-1 gap-3 p-5 md:grid-cols-[minmax(0,1fr)_170px_170px_auto] md:items-end">
            <Input
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Search name, email, phone, or role"
              aria-label="Search user records"
              iconLeft={<Search size={17} />}
              className="h-12"
            />
            <Select
              name="role"
              defaultValue={role}
              aria-label="Filter by role"
              className="h-12 min-w-0 px-4"
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select
              name="status"
              defaultValue={status}
              aria-label="Filter by status"
              className="h-12 min-w-0 px-4"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Button className="h-12 px-6">
              Search
            </Button>
          </form>
        </Card>

        <DataTableShell
          caption={(
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-on-surface">
                {filtered.length} user{filtered.length === 1 ? "" : "s"}
              </span>
              <span className="hidden text-xs text-on-surface-variant sm:inline">
                Click a row to open the user record
              </span>
            </div>
          )}
        >
            <table className={tableClasses()}>
              <thead className={tableHeadClasses()}>
                <tr>
                  <th className={tableHeaderCellClasses("px-5 py-3")}>
                    User
                  </th>
                  <th className={tableHeaderCellClasses("px-5 py-3")}>
                    Role
                  </th>
                  <th className={tableHeaderCellClasses("px-5 py-3")}>
                    Status
                  </th>
                  <th className={tableHeaderCellClasses("px-5 py-3")}>
                    Updated
                  </th>
                  <th className={tableHeaderCellClasses("px-5 py-3 text-right")}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => {
                  const href = `/admin/users/${user.id}`;
                  const primaryRole = user.roles[0] ?? "user";
                  return (
                  <tr
                    key={user.id}
                    className={tableRowClasses("group cursor-pointer")}
                  >
                    <td className={tableCellClasses("p-0")}>
                      <Link href={href} prefetch className={`${rowLinkClasses} flex items-center gap-3`}>
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-outline-variant/55 bg-surface-container-high text-on-surface-variant">
                          <UserRound size={17} />
                        </span>
                        <span>
                          <span className="block text-[15px] font-semibold text-on-surface">
                            {user.fullName || "Unnamed user"}
                          </span>
                          <span className="mt-0.5 block text-sm text-on-surface-variant">
                            {user.email || "No email"}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className={tableCellClasses("p-0")}>
                      <Link href={href} prefetch className={rowLinkClasses}>
                        <Badge
                          tone={primaryRole === "admin" ? "primary" : "neutral"}
                          className="px-3.5 py-1.5 text-[11px] tracking-[0.16em]"
                        >
                          {primaryRole}
                        </Badge>
                      </Link>
                    </td>
                    <td className={tableCellClasses("p-0")}>
                      <Link href={href} prefetch className={rowLinkClasses}>
                        <Badge
                          tone={user.status === "active" ? "success" : "neutral"}
                          className="px-3.5 py-1.5 text-[11px] tracking-[0.16em]"
                        >
                          {user.status}
                        </Badge>
                      </Link>
                    </td>
                    <td className={tableCellClasses("p-0 font-mono text-xs text-on-surface-variant tabular-nums")}>
                      <Link href={href} prefetch className={rowLinkClasses}>
                        {new Date(user.updatedAt).toLocaleDateString()}
                      </Link>
                    </td>
                    <td className={tableCellClasses("px-5 py-4 text-right")}>
                      <Button href={`/admin/users/${user.id}`} prefetch variant="secondary" size="sm">
                        Open
                      </Button>
                    </td>
                  </tr>
                );
                })}
              </tbody>
            </table>
        </DataTableShell>
      </div>
    </div>
  );
}
