'use client';

/** Per-row admin actions menu (set status, delete, etc.) on the user list. */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Copy, LogIn, PauseCircle, PlayCircle, Trash2 } from 'lucide-react';
import { RowActionsMenu, toast } from '@/app/components/ui';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { deleteUserAction, setUserStatusAction } from '@/app/actions/admin-users';
import { startImpersonationAction } from '@/app/actions/impersonation';

type Props = {
  userId: string;
  email: string | null;
  status: 'active' | 'suspended';
  displayName: string;
  canImpersonate: boolean;
};

export function UserRowActions({ userId, email, status, displayName, canImpersonate }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [impersonateConfirmOpen, setImpersonateConfirmOpen] = useState(false);

  const isActive = status === 'active';

  const copyEmail = async () => {
    if (!email) {
      toast.error('No email on file');
      return;
    }
    try {
      await navigator.clipboard.writeText(email);
      toast.success('Email copied');
    } catch {
      toast.error('Could not copy email');
    }
  };

  const toggleStatus = () => {
    startTransition(async () => {
      const next = isActive ? 'suspended' : 'active';
      const result = await setUserStatusAction({ userId, status: next });
      if (result.ok) {
        toast.success(`User ${next === 'active' ? 'activated' : 'suspended'}`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const confirmDelete = () => {
    startTransition(async () => {
      const result = await deleteUserAction({ userId });
      if (result.ok) {
        toast.success('User deleted');
        router.refresh();
      } else {
        toast.error(result.error);
      }
      setDeleteConfirmOpen(false);
    });
  };

  const startImpersonating = () => {
    startTransition(async () => {
      const result = await startImpersonationAction({ targetUserId: userId });
      if (result?.ok === false) {
        toast.error(result.error);
        setImpersonateConfirmOpen(false);
      }
    });
  };

  return (
    <>
      <RowActionsMenu
        items={[
          {
            label: 'Impersonate',
            icon: <LogIn size={14} />,
            disabled: !canImpersonate,
            onSelect: () => setImpersonateConfirmOpen(true),
          },
          {
            label: 'Copy email',
            icon: <Copy size={14} />,
            onSelect: copyEmail,
          },
          {
            label: isActive ? 'Suspend' : 'Activate',
            icon: isActive ? <PauseCircle size={14} /> : <PlayCircle size={14} />,
            onSelect: toggleStatus,
          },
          {
            label: 'Delete',
            icon: <Trash2 size={14} />,
            destructive: true,
            onSelect: () => setDeleteConfirmOpen(true),
          },
        ]}
      />
      <AlertDialog open={impersonateConfirmOpen} onOpenChange={setImpersonateConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Impersonate user?</AlertDialogTitle>
            <AlertDialogDescription>
              You will switch into {displayName}&apos;s account for support. This session is
              audited, expires automatically, and can be stopped from the sidebar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                startImpersonating();
              }}
            >
              Start impersonating
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the user profile and all role assignments. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              className="bg-[color:var(--color-status-danger)] text-white hover:bg-[color:var(--color-status-danger)]/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
