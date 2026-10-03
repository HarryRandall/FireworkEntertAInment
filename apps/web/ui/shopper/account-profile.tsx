/** Editable personal name beside the provider-verified account email. */
'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveDisplayName } from '@/lib/shopper/lists/actions';
import { Field } from '@/ui/kit/field';
import { Input } from '@/ui/primitives/input';
import { Button } from '@/ui/primitives/button';
/** Saves the owned display name while preserving unsaved input after a failed write. */
export function AccountProfile({ name, email }: { name: string; email: string }) {
  const [value, setValue] = useState(name);
  const [message, setMessage] = useState('');
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form
      data-section="account-profile"
      className="bg-card grid gap-4 rounded-lg border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          try {
            const outcome = await saveDisplayName(value);
            setMessage(outcome.status === 'ok' ? 'Profile saved.' : outcome.message);
            if (outcome.status === 'ok') router.refresh();
          } catch {
            setMessage('Your profile could not be saved. Please try again.');
          }
        });
      }}
    >
      <h2 className="text-xl font-semibold">Your account</h2>
      <Field id="display-name" label="Name">
        <Input
          id="display-name"
          autoComplete="name"
          value={value}
          disabled={pending}
          onChange={(event) => {
            setValue(event.target.value);
          }}
        />
      </Field>
      <p className="break-words">{email}</p>
      <p>Sign in with an email link. Your lists and plans belong to this account.</p>
      <Button type="submit" disabled={pending}>
        Save profile
      </Button>
      <p role="status">{message}</p>
    </form>
  );
}
