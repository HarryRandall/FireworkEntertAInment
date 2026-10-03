/** Route boundary for the supplier workspace. */
import type { ReactNode } from 'react';
import { WorkspaceShell } from '@/ui/shell/workspace-shell';

/** Composes this area's shared chrome around route-owned content. */
export default function Layout({ children }: { children: ReactNode }) {
  return <WorkspaceShell area="supplier">{children}</WorkspaceShell>;
}
