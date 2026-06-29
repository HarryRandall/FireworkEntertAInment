'use client';

/** Inline admin form for granting a user more AI credits. */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { grantUserAiCreditsAction } from '@/app/actions/admin-users';
import { Button } from '@/app/components/ui/Button';
import { Field, FieldHint, FieldLabel } from '@/app/components/ui/Field';
import { Input } from '@/app/components/ui/Input';
import { toast } from '@/app/components/ui/toast';

type Props = {
  userId: string;
};

export function GrantAiCreditsForm({ userId }: Props) {
  const router = useRouter();
  const [amount, setAmount] = useState('150');
  const [note, setNote] = useState('');
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-3 md:grid-cols-[8rem_minmax(0,1fr)_auto] md:items-end"
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
            setNote('');
            router.refresh();
          } else {
            toast.error(result.error, { id: toastId });
          }
        });
      }}
    >
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
      <Button type="submit" size="md" disabled={isPending}>
        <Plus size={16} />
        Grant
      </Button>
    </form>
  );
}
