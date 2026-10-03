/** Admin chrome delegates full-screen Studio composition to the authorised editor route. */
'use client';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { WorkspaceShell } from '@/ui/shell/workspace-shell';
import type { ShellIdentity } from '@/ui/shell/config/types';

/** Keeps ordinary admin routes in the workspace and prevents nested editor main landmarks. */
export function AdminFrame({
  children,
  identity,
}: {
  children: ReactNode;
  identity: ShellIdentity;
}) {
  const pathname = usePathname();
  return pathname.startsWith('/admin/studio/') ? (
    children
  ) : (
    <WorkspaceShell area="admin" identity={identity}>
      {children}
    </WorkspaceShell>
  );
}
