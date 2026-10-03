/** Server access boundary and workspace chrome for the admin area. */
import type { ReactNode } from 'react';
import { requireArea } from '@/lib/auth/server';
import { AdminFrame } from './_components/admin-frame';

/** Checks access on the server before composing the shared chrome around nested routes. */
export default async function Layout({ children }: { children: ReactNode }) {
  const identity = await requireArea('admin');
  return <AdminFrame identity={identity.workspace}>{children}</AdminFrame>;
}
