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
    <div className="space-y-8">
      <AppPageHeader
        title="Search user records"
        description="Search, filter, and scan records with stronger hierarchy and a tighter, more neutral palette."
      />

      <Card
        elevation="low"
        radius="lg"
        className="border-[#E2E8F0] bg-white p-0 shadow-[0_20px_45px_-36px_rgba(15,23,42,0.16)]"
      >
        <form className="grid grid-cols-1 gap-3 p-5 md:grid-cols-[minmax(0,1fr)_170px_170px_auto] md:items-end">
          <Input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search name, email, phone, or role"
            aria-label="Search user records"
            iconLeft={<Search size={17} />}
            className="h-12 rounded-xl border-[#CBD5E1] bg-white text-[#0F172A] placeholder:text-[#94A3B8]"
          />
          <Select
            name="role"
            defaultValue={role}
            aria-label="Filter by role"
            className="h-12 min-w-0 rounded-xl border-[#CBD5E1] bg-white px-4 text-[#0F172A]"
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
            className="h-12 min-w-0 rounded-xl border-[#CBD5E1] bg-white px-4 text-[#0F172A]"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Button className="h-12 rounded-xl border-[#2563EB] bg-[#2563EB] px-6 text-white shadow-none hover:brightness-100 hover:bg-[#1D4ED8]">
            Search
          </Button>
        </form>
      </Card>

      <DataTableShell
        className="border-[#E2E8F0] bg-white shadow-[0_20px_45px_-34px_rgba(15,23,42,0.14)]"
        caption={(
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-[#0F172A]">
              {filtered.length} user{filtered.length === 1 ? "" : "s"}
            </span>
            <span className="hidden text-xs text-[#64748B] sm:inline">
              Neutral surfaces, clearer row separation
            </span>
          </div>
        )}
      >
          <table className={tableClasses()}>
            <thead className={tableHeadClasses("bg-[#F8FAFC] text-[#64748B]")}>
              <tr>
                <th className={tableHeaderCellClasses("px-5 py-3 text-[11px] font-semibold tracking-[0.12em] text-[#475569]")}>
                  User
                </th>
                <th className={tableHeaderCellClasses("px-5 py-3 text-[11px] font-semibold tracking-[0.12em] text-[#475569]")}>
                  Role
                </th>
                <th className={tableHeaderCellClasses("px-5 py-3 text-[11px] font-semibold tracking-[0.12em] text-[#475569]")}>
                  Status
                </th>
                <th className={tableHeaderCellClasses("px-5 py-3 text-[11px] font-semibold tracking-[0.12em] text-[#475569]")}>
                  Updated
                </th>
                <th className={tableHeaderCellClasses("px-5 py-3 text-right text-[11px] font-semibold tracking-[0.12em] text-[#475569]")}>
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
                  className={tableRowClasses(
                    "group cursor-pointer border-[#E2E8F0] odd:bg-white even:bg-[#FBFDFF] hover:bg-[#F8FAFC] focus-within:bg-[#F8FAFC]",
                  )}
                >
                  <td className={tableCellClasses("p-0")}>
                    <Link href={href} prefetch className={`${rowLinkClasses} flex items-center gap-3`}>
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#475569]">
                        <UserRound size={17} />
                      </span>
                      <span>
                        <span className="block text-[15px] font-semibold tracking-[-0.02em] text-[#0F172A]">
                          {user.fullName || "Unnamed user"}
                        </span>
                        <span className="mt-0.5 block text-sm text-[#64748B]">
                          {user.email || "No email"}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className={tableCellClasses("p-0")}>
                    <Link href={href} prefetch className={rowLinkClasses}>
                      <Badge
                        tone={primaryRole === "admin" ? "primary" : "neutral"}
                        className={primaryRole === "admin"
                          ? "rounded-full border-[#BFDBFE] bg-[#EFF6FF] px-3.5 py-1.5 text-[11px] tracking-[0.16em] text-[#1D4ED8]"
                          : "rounded-full border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-1.5 text-[11px] tracking-[0.16em] text-[#475569]"}
                      >
                        {primaryRole}
                      </Badge>
                    </Link>
                  </td>
                  <td className={tableCellClasses("p-0")}>
                    <Link href={href} prefetch className={rowLinkClasses}>
                      <Badge
                        tone={user.status === "active" ? "success" : "neutral"}
                        className={user.status === "active"
                          ? "rounded-full border-[#BBF7D0] bg-[#F0FDF4] px-3.5 py-1.5 text-[11px] tracking-[0.16em] text-[#15803D]"
                          : "rounded-full border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-1.5 text-[11px] tracking-[0.16em] text-[#475569]"}
                      >
                        {user.status}
                      </Badge>
                    </Link>
                  </td>
                  <td className={tableCellClasses("p-0 font-mono text-xs text-[#64748B] tabular-nums")}>
                    <Link href={href} prefetch className={rowLinkClasses}>
                      {new Date(user.updatedAt).toLocaleDateString()}
                    </Link>
                  </td>
                  <td className={tableCellClasses("px-5 py-4 text-right")}>
                    <Link
                      href={`/admin/users/${user.id}`}
                      prefetch
                      className="inline-flex min-h-10 items-center rounded-full border border-[#CBD5E1] bg-white px-4 text-sm font-semibold text-[#0F172A] transition-colors hover:border-[#94A3B8] hover:bg-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#93C5FD]"
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
