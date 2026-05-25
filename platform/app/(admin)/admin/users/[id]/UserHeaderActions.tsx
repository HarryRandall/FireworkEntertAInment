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
import { deleteUserAction } from '@/app/actions/admin-users';

type Props = { userId: string };

export function UserHeaderActions({ userId }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const onDelete = () => {
    startTransition(async () => {
      const result = await deleteUserAction({ userId });
      if (result.ok) {
        toast.success('User deleted');
        router.push('/admin/users');
      } else {
        toast.error(result.error);
      }
      setConfirmOpen(false);
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
            onSelect: () => toast.info('Impersonation is not yet available'),
          },
          {
            label: 'Delete user',
            icon: <Trash2 size={14} />,
            destructive: true,
            onSelect: () => setConfirmOpen(true),
          },
        ]}
      />
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
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
