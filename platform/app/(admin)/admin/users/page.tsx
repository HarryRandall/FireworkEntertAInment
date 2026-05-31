/** Admin user list page with search, filters, and inline row actions. */

import Link from 'next/link';
import { Suspense } from 'react';
import { UserRound } from 'lucide-react';
import { AppPageHeader } from '@/app/components/app/AppPageHeader';
import { TableSkeleton } from '@/app/components/app/RouteSkeletons';
import { Badge } from '@/app/components/ui/Badge';
import { FilterBar } from '@/app/components/ui/FilterBar';
import { TABLE_PAGE_SIZE, TablePagination } from '@/app/components/ui/TablePagination';
import {
  DataTableShell,
  tableCellClasses,
  tableClasses,
  tableHeadClasses,
  tableHeaderCellClasses,
  tableRowClasses,
} from '@/app/components/ui/DataTable';
import { getCurrentProfile, listAdminUsers } from '@/lib/admin.server';
import type { ProfileStatus, RoleKey } from '@/lib/admin.types';
import { InlineCopyButton } from './InlineCopyButton';
import { UserRowActions } from './UserRowActions';

type PageProps = {
  searchParams: Promise<{ q?: string; role?: string; status?: string; page?: string }>;
};
type UsersSearchParams = Awaited<PageProps['searchParams']>;

const rowLinkClasses = 'block px-5 py-4';

function roleTone(role: RoleKey) {
  if (role === 'admin') return 'violet' as const;
  if (role === 'supplier') return 'sky' as const;
  return 'neutral' as const;
}

function statusTone(status: ProfileStatus) {
  if (status === 'active') return 'success' as const;
  if (status === 'suspended') return 'danger' as const;
  return 'amber-soft' as const;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8">
      <AppPageHeader title="Users" description="Search, filter, and manage platform users." />

      <FilterBar
        searchPlaceholder="Search name, email, phone…"
        filters={[
          {
            key: 'role',
            label: 'Role',
            type: 'select',
            options: [
              { value: 'admin', label: 'Admin' },
              { value: 'supplier', label: 'Supplier' },
              { value: 'user', label: 'User' },
            ],
          },
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            options: [
              { value: 'active', label: 'Active' },
              { value: 'suspended', label: 'Suspended' },
            ],
          },
        ]}
      />

      <Suspense
        fallback={
          <div className="min-h-0 flex-1 overflow-hidden">
            <TableSkeleton rows={TABLE_PAGE_SIZE} columns={5} />
          </div>
        }
      >
        <AdminUsersTable params={params} />
      </Suspense>
    </div>
  );
}

async function AdminUsersTable({ params }: { params: UsersSearchParams }) {
  const query = (params.q ?? '').trim().toLowerCase();
  const roleFilter = params.role;
  const statusFilter = params.status;
  const requestedPage = Number(params.page ?? '1');
  const [users, currentProfile] = await Promise.all([listAdminUsers(), getCurrentProfile()]);
  const canStartImpersonation = Boolean(
    currentProfile?.permissions.includes('admin.impersonate_users'),
  );
  const filtered = users.filter((user) => {
    const text = [user.fullName, user.email, user.phone, user.roles.join(' ')]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const matchesQuery = !query || text.includes(query);
    const matchesRole = !roleFilter || user.roles.some((r) => r === roleFilter);
    const matchesStatus = !statusFilter || user.status === statusFilter;
    return matchesQuery && matchesRole && matchesStatus;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / TABLE_PAGE_SIZE));
  const currentPage = Number.isFinite(requestedPage)
    ? Math.min(Math.max(1, requestedPage), totalPages)
    : 1;
  const pageStart = (currentPage - 1) * TABLE_PAGE_SIZE;
  const paginated = filtered.slice(pageStart, pageStart + TABLE_PAGE_SIZE);

  return (
    <>
      <DataTableShell>
        <table className={tableClasses()}>
          <thead className={tableHeadClasses()}>
            <tr>
              <th className={tableHeaderCellClasses('px-5 py-3')}>User</th>
              <th className={tableHeaderCellClasses('px-5 py-3')}>Role</th>
              <th className={tableHeaderCellClasses('px-5 py-3')}>Status</th>
              <th className={tableHeaderCellClasses('px-5 py-3')}>Updated</th>
              <th className={tableHeaderCellClasses('px-5 py-3 text-right')}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((user) => {
              const href = `/admin/users/${user.id}`;
              const primaryRole = user.roles[0] ?? 'user';
              const displayName = user.fullName || 'Unnamed user';
              const canImpersonate =
                canStartImpersonation && user.status === 'active' && user.id !== currentProfile?.id;
              return (
                <tr key={user.id} className={tableRowClasses('group')}>
                  <td className={tableCellClasses('p-0')}>
                    <div className="flex items-center gap-3 px-5 py-4">
                      <Link
                        href={href}
                        prefetch
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-bg-subtle)] text-[color:var(--color-content-subtle)] transition-colors hover:text-[color:var(--color-content-emphasis)] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-content-emphasis)]"
                        aria-label={`View ${displayName}`}
                      >
                        <UserRound size={16} />
                      </Link>
                      <span className="min-w-0 flex-1">
                        <span className="group/identity flex min-w-0 items-center gap-1.5">
                          <Link
                            href={href}
                            prefetch
                            className="min-w-0 truncate text-sm font-medium text-[color:var(--color-content-emphasis)] hover:underline focus:underline focus:outline-none"
                          >
                            {displayName}
                          </Link>
                          {user.fullName ? (
                            <InlineCopyButton
                              value={user.fullName}
                              label={`Copy ${user.fullName}'s name`}
                              successMessage="Name copied"
                            />
                          ) : null}
                        </span>
                        <span className="group/identity mt-0.5 flex min-w-0 items-center gap-1.5">
                          {user.email ? (
                            <>
                              <Link
                                href={href}
                                prefetch
                                className="min-w-0 truncate text-xs text-[color:var(--color-content-subtle)] hover:underline focus:underline focus:outline-none"
                              >
                                {user.email}
                              </Link>
                              <InlineCopyButton
                                value={user.email}
                                label={`Copy ${user.email}`}
                                successMessage="Email copied"
                              />
                            </>
                          ) : (
                            <span className="text-xs text-[color:var(--color-content-subtle)]">
                              No email
                            </span>
                          )}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className={tableCellClasses('p-0')}>
                    <Link href={href} prefetch className={rowLinkClasses}>
                      <Badge solid tone={roleTone(primaryRole)}>
                        {primaryRole}
                      </Badge>
                    </Link>
                  </td>
                  <td className={tableCellClasses('p-0')}>
                    <Link href={href} prefetch className={rowLinkClasses}>
                      <Badge solid tone={statusTone(user.status)}>
                        {user.status}
                      </Badge>
                    </Link>
                  </td>
                  <td
                    className={tableCellClasses(
                      'p-0 font-mono text-xs text-[color:var(--color-content-subtle)] tabular-nums',
                    )}
                  >
                    <Link href={href} prefetch className={rowLinkClasses}>
                      {new Date(user.updatedAt).toLocaleDateString()}
                    </Link>
                  </td>
                  <td className={tableCellClasses('px-5 py-4 text-right')}>
                    <UserRowActions
                      userId={user.id}
                      email={user.email}
                      status={user.status}
                      displayName={user.fullName || user.email || 'this user'}
                      canImpersonate={canImpersonate}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DataTableShell>

      <TablePagination currentPage={currentPage} totalPages={totalPages} searchParams={params} />
    </>
  );
}
