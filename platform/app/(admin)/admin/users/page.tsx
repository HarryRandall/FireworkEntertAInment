import Link from "next/link";
import { Search, UserRound } from "lucide-react";
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
import { Input } from "@/app/components/ui/Input";
import { SelectField } from "@/app/components/ui/SelectField";
import { listAdminUsers } from "@/lib/platform.server";

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

const rowLinkClasses = "block px-4 py-3";

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
    <div className="space-y-6">
      <header className="border-b border-outline-variant/55 pb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
          Users
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-on-surface">
          Search user records
        </h1>
      </header>

      <Card elevation="high" radius="md" className="p-4">
        <form className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_160px_160px_auto]">
          <Input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search name, email, phone, or role"
            aria-label="Search user records"
            iconLeft={<Search size={17} />}
          />
          <SelectField
            name="role"
            defaultValue={role}
            options={ROLE_OPTIONS}
            ariaLabel="Filter by role"
          />
          <SelectField
            name="status"
            defaultValue={status}
            options={STATUS_OPTIONS}
            ariaLabel="Filter by status"
          />
          <Button>
            Search
          </Button>
        </form>
      </Card>

      <DataTableShell
        caption={`${filtered.length} user${filtered.length === 1 ? "" : "s"}`}
      >
          <table className={tableClasses()}>
            <thead className={tableHeadClasses()}>
              <tr>
                <th className={tableHeaderCellClasses()}>User</th>
                <th className={tableHeaderCellClasses()}>Role</th>
                <th className={tableHeaderCellClasses()}>Status</th>
                <th className={tableHeaderCellClasses()}>Updated</th>
                <th className={tableHeaderCellClasses("text-right")}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => {
                const href = `/admin/users/${user.id}`;
                const primaryRole = user.roles[0] ?? "user";
                return (
                <tr key={user.id} className={tableRowClasses("group cursor-pointer")}>
                  <td className={tableCellClasses("p-0")}>
                    <Link href={href} prefetch className={`${rowLinkClasses} flex items-center gap-3`}>
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-tertiary/20 bg-tertiary/12 text-tertiary">
                        <UserRound size={17} />
                      </span>
                      <span>
                        <span className="block font-bold text-on-surface">
                          {user.fullName || "Unnamed user"}
                        </span>
                        <span className="block text-xs text-on-surface-variant">
                          {user.email || "No email"}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className={tableCellClasses("p-0")}>
                    <Link href={href} prefetch className={rowLinkClasses}>
                      <Badge tone={primaryRole === "admin" ? "primary" : "neutral"}>
                        {primaryRole}
                      </Badge>
                    </Link>
                  </td>
                  <td className={tableCellClasses("p-0")}>
                    <Link href={href} prefetch className={rowLinkClasses}>
                      <Badge tone={user.status === "active" ? "success" : "neutral"}>
                        {user.status}
                      </Badge>
                    </Link>
                  </td>
                  <td className={tableCellClasses("p-0 font-mono text-xs text-on-surface-variant tabular-nums")}>
                    <Link href={href} prefetch className={rowLinkClasses}>
                      {new Date(user.updatedAt).toLocaleDateString()}
                    </Link>
                  </td>
                  <td className={tableCellClasses("text-right")}>
                    <Link
                      href={href}
                      prefetch
                      className="rounded-lg border border-outline-variant/45 px-4 py-2 text-xs font-bold text-primary transition-colors hover:border-primary/40 hover:bg-surface-container-highest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/55"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
      </DataTableShell>
    </div>
  );
}
