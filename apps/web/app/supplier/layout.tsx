/** Server access boundary and workspace chrome for the supplier area. */
import type { ReactNode } from 'react';
import { requireArea } from '@/lib/auth/server';
import { WorkspaceShell } from '@/ui/shell/workspace-shell';

/** Checks access on the server before composing the shared chrome around nested routes. */
export default async function Layout({ children }: { children: ReactNode }) {
  const identity = await requireArea('supplier');
  return (
    <WorkspaceShell area="supplier" identity={identity.workspace}>
      {children}
    </WorkspaceShell>
  );
}
