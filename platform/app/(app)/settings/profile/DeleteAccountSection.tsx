'use client';

/** Client section that confirms and triggers the `deleteAccountAction` server action. */

import { useActionState, useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteAccountAction, type DeleteAccountState } from '@/app/actions/account';
import { Button } from '@/app/components/ui/Button';
import { Input } from '@/app/components/ui/Input';
import { Field, FieldHint, FieldLabel } from '@/app/components/ui/Field';
import { InlineAlert } from '@/app/components/ui/Feedback';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const initialState: DeleteAccountState = { status: 'idle' };
const CONFIRM_PHRASE = 'delete my account';

export function DeleteAccountSection({ disabled = false }: { disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [state, formAction, pending] = useActionState(deleteAccountAction, initialState);

  const canSubmit = confirmation.trim().toLowerCase() === CONFIRM_PHRASE;

  useEffect(() => {
    if (!open) {
      setConfirmation('');
    }
  }, [open]);

  return (
    <>
      <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-foreground text-sm font-medium">Delete account</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Permanently remove your account, profile, and any shows you own. This cannot be undone.
          </p>
        </div>
        <Button
          type="button"
          variant="destructive"
          onClick={() => setOpen(true)}
          disabled={disabled}
        >
          <Trash2 size={16} strokeWidth={1.85} />
          Delete account
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete account?</DialogTitle>
            <DialogDescription>
              This permanently removes your account, profile, and any shows you own. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>

          <form action={formAction} className="space-y-4">
            <Field>
              <FieldLabel htmlFor="deletePassword">Current password</FieldLabel>
              <Input
                id="deletePassword"
                type="password"
                name="password"
                autoComplete="current-password"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="deleteConfirmation">
                Type <span className="font-mono">{CONFIRM_PHRASE}</span> to confirm
              </FieldLabel>
              <Input
                id="deleteConfirmation"
                name="confirmation"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="off"
                required
              />
              <FieldHint>We&apos;ll sign you out and remove your access immediately.</FieldHint>
            </Field>

            {state.status === 'error' && state.message ? (
              <InlineAlert tone="danger" title="Account not deleted">
                {state.message}
              </InlineAlert>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" variant="destructive" loading={pending} disabled={!canSubmit}>
                <Trash2 size={16} strokeWidth={1.85} />
                Permanently delete
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
