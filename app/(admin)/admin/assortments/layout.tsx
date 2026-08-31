import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { requirePermission } from '@/lib/admin/current-user.server';

export default async function AdminAssortmentsLayout({ children }: { children: ReactNode }) {
  const profile = await requirePermission('admin.manage_assortments');
  if (!profile) redirect('/admin');

  return children;
}
