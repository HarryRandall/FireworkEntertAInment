import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { requirePermission } from '@/lib/admin/current-user.server';

export default async function AdminShowPresetsLayout({ children }: { children: ReactNode }) {
  const profile = await requirePermission('admin.manage_catalogue');
  if (!profile) redirect('/admin');

  return children;
}
