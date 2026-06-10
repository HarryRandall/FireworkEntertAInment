'use client';

/** Client form that calls the password-update server action. */

import { useActionState, useEffect, useRef } from 'react';
import { KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import { updatePasswordAction, type PasswordActionState } from '@/app/actions/account';
import { Button } from '@/app/components/ui/Button';
import { Input } from '@/app/components/ui/Input';
import { InlineAlert } from '@/app/components/ui/Feedback';
import { Field, FieldHint, FieldLabel } from '@/app/components/ui/Field';

const initialState: PasswordActionState = { status: 'idle' };

export function PasswordChangeForm({ disabled = false }: { disabled?: boolean }) {
  const [state, formAction, pending] = useActionState(updatePasswordAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === 'success') {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      <Field>
        <FieldLabel htmlFor="currentPassword">Current password</FieldLabel>
        <Input
          id="currentPassword"
          type="password"
          name="currentPassword"
          autoComplete="current-password"
          required
          disabled={disabled}
          iconLeft={<LockKeyhole size={17} />}
        />
        <FieldHint>Required so an open browser session cannot change credentials alone.</FieldHint>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="newPassword">New password</FieldLabel>
          <Input
            id="newPassword"
            type="password"
            name="newPassword"
            autoComplete="new-password"
            minLength={8}
            required
            disabled={disabled}
            iconLeft={<KeyRound size={17} />}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="confirmPassword">Confirm new password</FieldLabel>
          <Input
            id="confirmPassword"
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            minLength={8}
            required
            disabled={disabled}
            iconLeft={<ShieldCheck size={17} />}
          />
        </Field>
      </div>

      <div className="border-border bg-muted/30 rounded-lg border p-4">
        <p className="text-foreground text-sm font-medium">Password requirements</p>
        <div className="text-muted-foreground mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <span>8 or more characters</span>
          <span>Different from old password</span>
          <span>Stored by Supabase auth</span>
        </div>
      </div>

      {state.status === 'error' && state.message ? (
        <InlineAlert tone="danger" title="Password not updated">
          {state.message}
        </InlineAlert>
      ) : null}
      {state.status === 'success' ? (
        <InlineAlert tone="success" title="Password updated">
          {state.message}
        </InlineAlert>
      ) : null}

      <div className="border-border flex justify-end border-t pt-5">
        <Button type="submit" loading={pending} disabled={disabled}>
          Update password
        </Button>
      </div>
    </form>
  );
}
