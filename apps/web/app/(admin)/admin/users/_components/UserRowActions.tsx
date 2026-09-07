'use client';

/** Per-row admin actions menu (set status, delete, etc.) on the user list. */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Copy, LogIn, PauseCircle, PlayCircle, Trash2 } from 'lucide-react';
import { RowActionsMenu, toast } from '@/components/design-system';
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
  const [isPending, startTransition] = useTransition();
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
      try {
        const next = isActive ? 'suspended' : 'active';
        const result = await setUserStatusAction({ userId, status: next });
        if (result.ok) {
          toast.success(`User ${next === 'active' ? 'activated' : 'suspended'}`);
          router.refresh();
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error('Could not update the user status');
      }
    });
  };

  const confirmDelete = () => {
    startTransition(async () => {
      try {
        const result = await deleteUserAction({ userId });
        if (result.ok) {
          toast.success('User deleted');
          router.refresh();
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error('Could not delete the user');
      } finally {
        setDeleteConfirmOpen(false);
      }
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
        busy={isPending}
        items={[
          {
            label: 'Impersonate',
            icon: <LogIn size={14} />,
            disabled: isPending || !canImpersonate,
            onSelect: () => setImpersonateConfirmOpen(true),
          },
          {
            label: 'Copy email',
            icon: <Copy size={14} />,
            disabled: isPending,
            onSelect: copyEmail,
          },
          {
            label: isPending ? 'Updating…' : isActive ? 'Suspend' : 'Activate',
            icon: isActive ? <PauseCircle size={14} /> : <PlayCircle size={14} />,
            disabled: isPending,
            onSelect: toggleStatus,
          },
          {
            label: 'Delete',
            icon: <Trash2 size={14} />,
            destructive: true,
            disabled: isPending,
            onSelect: () => setDeleteConfirmOpen(true),
          },
        ]}
      />
      <AlertDialog
        open={impersonateConfirmOpen}
        onOpenChange={(open) => {
          if (!isPending) setImpersonateConfirmOpen(open);
        }}
      >
        <AlertDialogContent aria-busy={isPending || undefined}>
          <AlertDialogHeader>
            <AlertDialogTitle>Impersonate user?</AlertDialogTitle>
            <AlertDialogDescription>
              You will switch into {displayName}&apos;s account for support. This session is
              audited, expires automatically, and can be stopped from the sidebar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={(e) => {
                e.preventDefault();
                startImpersonating();
              }}
            >
              {isPending ? 'Starting…' : 'Start impersonating'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteConfirmOpen}
        onOpenChange={(open) => {
          if (!isPending) setDeleteConfirmOpen(open);
        }}
      >
        <AlertDialogContent aria-busy={isPending || undefined}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the user profile and all role assignments. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              variant="destructive"
            >
              {isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
