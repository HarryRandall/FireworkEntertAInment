'use client';

/** Header action buttons (suspend, delete, etc.) on the admin user detail page. */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Coins, KeyRound, LogIn, Trash2 } from 'lucide-react';
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
import { startImpersonationAction } from '@/app/actions/impersonation';
import { deleteUserAction, sendUserPasswordResetAction } from '@/app/actions/admin-users';
import { GrantAiCreditsDialog } from './GrantAiCreditsDialog';

type Props = {
  userId: string;
  displayName: string;
  canImpersonate: boolean;
  canManageBilling: boolean;
};

export function UserHeaderActions({
  userId,
  displayName,
  canImpersonate,
  canManageBilling,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [grantCreditsOpen, setGrantCreditsOpen] = useState(false);
  const [impersonateConfirmOpen, setImpersonateConfirmOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  const onResetPassword = () => {
    startTransition(async () => {
      const result = await sendUserPasswordResetAction({ userId });
      if (result.ok) {
        toast.success('Password reset email sent');
      } else {
        toast.error(result.error);
      }
      setResetConfirmOpen(false);
    });
  };

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
            disabled: isPending,
            onSelect: () => setResetConfirmOpen(true),
          },
          {
            label: 'Impersonate',
            icon: <LogIn size={14} />,
            disabled: !canImpersonate || isPending,
            onSelect: () => setImpersonateConfirmOpen(true),
          },
          ...(canManageBilling
            ? [
                {
                  label: 'Grant AI credits',
                  icon: <Coins size={14} />,
                  disabled: isPending,
                  onSelect: () => setGrantCreditsOpen(true),
                },
              ]
            : []),
          {
            label: 'Delete user',
            icon: <Trash2 size={14} />,
            destructive: true,
            disabled: isPending,
            onSelect: () => setDeleteConfirmOpen(true),
          },
        ]}
      />
      {canManageBilling ? (
        <GrantAiCreditsDialog
          userId={userId}
          open={grantCreditsOpen}
          onOpenChange={setGrantCreditsOpen}
        />
      ) : null}
      <AlertDialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send password reset?</AlertDialogTitle>
            <AlertDialogDescription>
              Supabase will email {displayName} a secure link to choose a new password.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault();
                onResetPassword();
              }}
            >
              Send reset email
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
              This permanently removes the Supabase Auth account and its cascading shows, analyses,
              permissions and billing records. This cannot be undone.
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
