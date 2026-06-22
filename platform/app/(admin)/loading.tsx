'use client';

/** Loading skeleton for admin routes. */

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import {
  AdminEffectEditorSkeleton,
  AdminFireworkEditorSkeleton,
  AdminImportDetailSkeleton,
  AdminImportsSkeleton,
  AdminOverviewRouteSkeleton,
  AdminPromptsSkeleton,
  AdminRolesSkeleton,
  AdminTableRouteSkeleton,
  AdminUserDetailSkeleton,
} from '@/app/components/app/RouteSkeletons';
import { Skeleton } from '@/app/components/ui/Feedback';

function AdminEditorLoadingFrame({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-6 -my-6 flex h-[calc(100svh-3.5rem)] min-h-0 flex-1 sm:-mx-8 md:h-[calc(100svh-4.5rem)] lg:-mx-10">
      {children}
    </div>
  );
}

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
    return (
      <AdminTableRouteSkeleton
        searchPlaceholder="Search name, email, phone..."
        headers={['User', 'Role', 'Status', 'Updated', 'Actions']}
        rows={8}
        ariaLabel="Loading admin users"
      />
    );
  }

  if (/^\/admin\/roles\/?$/.test(currentPathname)) {
    return <AdminRolesSkeleton />;
  }

  if (/^\/admin\/prompts\/?$/.test(currentPathname)) {
    return <AdminPromptsSkeleton />;
  }

  if (/^\/admin\/suppliers\/?$/.test(currentPathname)) {
    return (
      <AdminTableRouteSkeleton
        searchPlaceholder="Search name, email, phone, website..."
        headers={['Name', 'Email', 'Phone', 'Website', 'Status', 'Actions']}
        rowSize="relaxed"
        rows={8}
        hasAction
        ariaLabel="Loading suppliers"
      />
    );
  }

  if (/^\/admin\/catalogue\/?$/.test(currentPathname)) {
    return (
      <AdminTableRouteSkeleton
        searchPlaceholder="Search part #, name, manufacturer..."
        headers={['Part', 'Product', 'Manufacturer', 'Type', 'Duration', 'Actions']}
        tableClassName="min-w-[960px]"
        rowSize="relaxed"
        rows={8}
        hasAction
        ariaLabel="Loading catalogue"
      />
    );
  }

  if (/^\/admin\/fireworks\/[^/]+\/?$/.test(currentPathname)) {
    return (
      <AdminEditorLoadingFrame>
        <AdminFireworkEditorSkeleton />
      </AdminEditorLoadingFrame>
    );
  }

  if (/^\/admin\/fireworks\/?$/.test(currentPathname)) {
    return (
      <AdminTableRouteSkeleton
        searchPlaceholder="Search product, part number, effect..."
        headers={[
          'Preview',
          'Product',
          'Manufacturer',
          'Type',
          'Effects',
          'Calibre',
          'Shots',
          'Duration',
          'Open',
        ]}
        tableClassName="min-w-[1120px]"
        rows={8}
        ariaLabel="Loading fireworks"
      />
    );
  }

  if (/^\/admin\/effects\/[^/]+\/?$/.test(currentPathname)) {
    return (
      <AdminEditorLoadingFrame>
        <AdminEffectEditorSkeleton />
      </AdminEditorLoadingFrame>
    );
  }

  if (/^\/admin\/effects\/?$/.test(currentPathname)) {
    return (
      <AdminTableRouteSkeleton
        searchPlaceholder="Search name, slug, description..."
        headers={[
          'Preview',
          'Effect',
          'Family',
          'Pattern',
          'Source',
          'Variants',
          'Updated',
          'Open',
        ]}
        tableClassName="min-w-[1080px]"
        rows={12}
        ariaLabel="Loading effects"
      />
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
