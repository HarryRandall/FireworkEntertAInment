/** Server access boundary and workspace chrome for the shopper account area. */
import type { ReactNode } from 'react';
import { requireArea } from '@/lib/auth/server';
import { WorkspaceShell } from '@/ui/shell/workspace-shell';

/** Checks access on the server before composing the shared chrome around nested routes. */
export default async function Layout({ children }: { children: ReactNode }) {
  await requireArea('account');
  return <WorkspaceShell area="account">{children}</WorkspaceShell>;
}
