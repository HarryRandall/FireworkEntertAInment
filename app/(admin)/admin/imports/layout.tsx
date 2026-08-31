import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { requirePermission } from '@/lib/admin/current-user.server';

export default async function AdminImportsLayout({ children }: { children: ReactNode }) {
  const profile = await requirePermission('admin.manage_imports');
  if (!profile) redirect('/admin');

  return children;
}
