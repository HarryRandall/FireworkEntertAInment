'use client';

/** Loading skeleton for admin routes. */

import { usePathname } from 'next/navigation';
import {
  AdminEffectEditorSkeleton,
  AdminFireworkEditorSkeleton,
  AdminImportDetailSkeleton,
  AdminImportsSkeleton,
  AdminOverviewRouteSkeleton,
  AdminRolesSkeleton,
  AdminTableRouteSkeleton,
  AdminUserDetailSkeleton,
} from '@/app/components/app/RouteSkeletons';
import { Skeleton } from '@/app/components/ui/Feedback';

export default function AdminLoading() {
  const pathname = usePathname();
  const currentPathname = pathname ?? '';

  if (/^\/admin\/?$/.test(currentPathname)) {
    return <AdminOverviewRouteSkeleton />;
  }

  if (/^\/admin\/users\/[^/]+\/?$/.test(currentPathname)) {
    return <AdminUserDetailSkeleton />;
  }

  if (/^\/admin\/users\/?$/.test(currentPathname)) {
    return <AdminTableRouteSkeleton rows={10} columns={5} ariaLabel="Loading admin users" />;
  }

  if (/^\/admin\/roles\/?$/.test(currentPathname)) {
    return <AdminRolesSkeleton />;
  }

  if (/^\/admin\/suppliers\/?$/.test(currentPathname)) {
    return (
      <AdminTableRouteSkeleton
        rows={10}
        columns={6}
        filterCount={1}
        hasAction
        ariaLabel="Loading suppliers"
      />
    );
  }

  if (/^\/admin\/catalogue\/?$/.test(currentPathname)) {
    return (
      <AdminTableRouteSkeleton
        rows={10}
        columns={6}
        filterCount={3}
        hasAction
        ariaLabel="Loading catalogue"
      />
    );
  }

  if (/^\/admin\/fireworks\/[^/]+\/?$/.test(currentPathname)) {
    return <AdminFireworkEditorSkeleton />;
  }

  if (/^\/admin\/fireworks\/?$/.test(currentPathname)) {
    return (
      <AdminTableRouteSkeleton
        rows={10}
        columns={9}
        filterCount={3}
        ariaLabel="Loading fireworks"
      />
    );
  }

  if (/^\/admin\/effects\/[^/]+\/?$/.test(currentPathname)) {
    return <AdminEffectEditorSkeleton />;
  }

  if (/^\/admin\/effects\/?$/.test(currentPathname)) {
    return (
      <AdminTableRouteSkeleton rows={12} columns={8} filterCount={2} ariaLabel="Loading effects" />
    );
  }

  if (/^\/admin\/imports\/[^/]+\/?$/.test(currentPathname)) {
    return <AdminImportDetailSkeleton />;
  }

  if (/^\/admin\/imports\/?$/.test(currentPathname)) {
    return <AdminImportsSkeleton />;
  }

  return (
    <div className="space-y-6" aria-label="Loading admin data">
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-72" />
      </div>
      <Skeleton className="h-20 rounded-xl" />
      <Skeleton className="h-[420px] rounded-xl" />
    </div>
  );
}
