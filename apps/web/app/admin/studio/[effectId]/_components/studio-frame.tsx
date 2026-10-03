/** Studio supplies editor actions to the shared workspace shell. */
import type { ReactNode } from 'react';
import type { ShellIdentity } from '@/ui/shell/config/types';
import { WorkspaceShell } from '@/ui/shell/workspace-shell';

/** Keeps save and preview reset actions in the shared editor frame. */
export function StudioFrame({
  title,
  identity,
  save,
  saving,
  onResetVisibility,
  children,
}: {
  title: string;
  identity: ShellIdentity;
  save: () => void;
  saving: boolean;
  onResetVisibility: () => void;
  children: ReactNode;
}) {
  return (
    <WorkspaceShell
      area="admin"
      identity={identity}
      editorFrame={{
        title,
        onSave: save,
        saving,
        actions: [{ label: 'Reset preview visibility', onSelect: onResetVisibility }],
      }}
    >
      {children}
    </WorkspaceShell>
  );
}
