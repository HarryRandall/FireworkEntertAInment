import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { requirePermission } from '@/lib/admin/current-user.server';

export default async function AdminBillingLayout({ children }: { children: ReactNode }) {
  const profile = await requirePermission('admin.manage_billing');
  if (!profile) redirect('/admin');

  return children;
}
