'use client';

/** Client form that calls the password-update server action. */

import { useActionState, useEffect, useRef } from 'react';
import { KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import { updatePasswordAction, type PasswordActionState } from '@/app/actions/account';
import { Button } from '@/components/design-system/Button';
import { Input } from '@/components/design-system/Input';
import { InlineAlert } from '@/components/design-system/Feedback';
import { Field, FieldHint, FieldLabel } from '@/components/design-system/Field';

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
    <form ref={formRef} action={formAction} className="space-y-4">
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

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
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

      <div className="flex justify-end">
        <Button type="submit" loading={pending} disabled={disabled} className="w-full sm:w-auto">
          Update password
        </Button>
      </div>
    </form>
  );
}
