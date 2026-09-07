'use client';

/** Dialog for granting a user more AI credits from the admin actions menu. */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { grantUserAiCreditsAction } from '@/app/actions/admin-users';
import { Button } from '@/components/design-system/Button';
import { Field, FieldHint, FieldLabel } from '@/components/design-system/Field';
import { Input } from '@/components/design-system/Input';
import { toast } from '@/components/design-system/toast';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Props = {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const DEFAULT_GRANT_AMOUNT = '150';

export function GrantAiCreditsDialog({ userId, open, onOpenChange }: Props) {
  const router = useRouter();
  const [amount, setAmount] = useState(DEFAULT_GRANT_AMOUNT);
  const [note, setNote] = useState('');
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setAmount(DEFAULT_GRANT_AMOUNT);
    setNote('');
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) reset();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <form
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            const grantAmount = Number(amount);
            const toastId = toast.loading('Granting AI credits...');
            startTransition(async () => {
              const result = await grantUserAiCreditsAction({
                userId,
                amount: grantAmount,
                note,
              });
              if (result.ok) {
                toast.success('AI credits granted.', { id: toastId });
                handleOpenChange(false);
                router.refresh();
              } else {
                toast.error(result.error, { id: toastId });
              }
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>Grant AI credits</DialogTitle>
            <DialogDescription>
              Add credits to this user's balance and store a note in the AI credit ledger.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <Field>
              <FieldLabel htmlFor="ai-credit-grant-amount">Credits</FieldLabel>
              <Input
                id="ai-credit-grant-amount"
                inputMode="numeric"
                min={1}
                max={100000}
                onChange={(event) => setAmount(event.target.value)}
                required
                type="number"
                value={amount}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="ai-credit-grant-note">Note</FieldLabel>
              <Input
                id="ai-credit-grant-note"
                maxLength={280}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Reason for the grant"
                value={note}
              />
              <FieldHint>Stored in the AI credit ledger.</FieldHint>
            </Field>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              <Plus size={16} />
              Grant credits
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
