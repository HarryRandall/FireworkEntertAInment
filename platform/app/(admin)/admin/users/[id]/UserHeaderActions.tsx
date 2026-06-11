'use client';

/** Header action buttons (suspend, delete, etc.) on the admin user detail page. */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, LogIn, Trash2 } from 'lucide-react';
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
import { startImpersonationAction } from '@/app/actions/impersonation';
import { deleteUserAction } from '@/app/actions/admin-users';

type Props = {
  userId: string;
  displayName: string;
  canImpersonate: boolean;
};

export function UserHeaderActions({ userId, displayName, canImpersonate }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [impersonateConfirmOpen, setImpersonateConfirmOpen] = useState(false);

  const onDelete = () => {
    startTransition(async () => {
      const result = await deleteUserAction({ userId });
      if (result.ok) {
        toast.success('User deleted');
        router.push('/admin/users');
      } else {
        toast.error(result.error);
      }
      setDeleteConfirmOpen(false);
    });
  };

  const onImpersonate = () => {
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
            label: 'Reset password',
            icon: <KeyRound size={14} />,
            onSelect: () => toast.info('Password reset link sent (placeholder)'),
          },
          {
            label: 'Impersonate',
            icon: <LogIn size={14} />,
            disabled: !canImpersonate,
            onSelect: () => setImpersonateConfirmOpen(true),
          },
          {
            label: 'Delete user',
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
              audited, expires automatically, and can be stopped from the banner.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                onImpersonate();
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
              This permanently removes the user profile. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                onDelete();
              }}
              variant="destructive"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
