/** Studio supplies editor actions to the shared workspace shell. */
import type { ReactNode } from 'react';
import type { ShellIdentity } from '@/ui/shell/config/types';
import { WorkspaceShell } from '@/ui/shell/workspace-shell';

/** Keeps save, history and preview actions in the shared editor frame. */
export function StudioFrame({
  title,
  identity,
  save,
  saving,
  saveDisabled,
  onResetVisibility,
  onHistory,
  historyBusy,
  children,
}: {
  title: string;
  identity: ShellIdentity;
  save: () => void;
  saving: boolean;
  saveDisabled: boolean;
  onResetVisibility: () => void;
  onHistory: () => void;
  historyBusy: boolean;
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
        saveDisabled,
        actions: [
          { label: 'Version history', onSelect: onHistory, disabled: historyBusy },
          { label: 'Reset preview visibility', onSelect: onResetVisibility },
        ],
      }}
    >
      {children}
    </WorkspaceShell>
  );
}
