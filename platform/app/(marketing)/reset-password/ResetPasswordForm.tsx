'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { Lock } from 'lucide-react';
import { updateRecoveredPasswordAction } from '@/app/actions/password-recovery';
import { Button } from '@/app/components/ui/Button';
import { FormError } from '@/app/components/ui/FormError';
import { Input } from '@/app/components/ui/Input';

type ResetPasswordError = {
  message: string;
  field: 'password' | 'confirmPassword' | null;
};

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<ResetPasswordError | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError({ message: 'Password must be at least 8 characters.', field: 'password' });
      const passwordInput = event.currentTarget.elements.namedItem('password');
      if (passwordInput instanceof HTMLInputElement) passwordInput.focus();
      return;
    }
    if (password.length > 128) {
      setError({ message: 'Password is too long.', field: 'password' });
      const passwordInput = event.currentTarget.elements.namedItem('password');
      if (passwordInput instanceof HTMLInputElement) passwordInput.focus();
      return;
    }
    if (password !== confirmPassword) {
      setError({ message: 'Passwords do not match.', field: 'confirmPassword' });
      const confirmPasswordInput = event.currentTarget.elements.namedItem('confirmPassword');
      if (confirmPasswordInput instanceof HTMLInputElement) confirmPasswordInput.focus();
      return;
    }

    startTransition(async () => {
      try {
        const result = await updateRecoveredPasswordAction({ password, confirmPassword });
        if (!result.ok) {
          setError({ message: result.error, field: null });
          return;
        }

        router.replace('/home');
        router.refresh();
      } catch (actionError) {
        console.error('[password-recovery] action failed:', actionError);
        setError({ message: 'Could not update your password. Please try again.', field: null });
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="space-y-2">
        <label
          htmlFor="password"
          className="block text-sm font-medium text-[color:var(--color-content-emphasis)]"
        >
          New password
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setError(null);
          }}
          placeholder="At least 8 characters"
          iconLeft={<Lock size={16} aria-hidden="true" />}
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          aria-describedby={error?.field === 'password' ? 'password-recovery-error' : undefined}
          invalid={error?.field === 'password'}
        />
      </div>
      <div className="space-y-2">
        <label
          htmlFor="confirmPassword"
          className="block text-sm font-medium text-[color:var(--color-content-emphasis)]"
        >
          Confirm new password
        </label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(event) => {
            setConfirmPassword(event.target.value);
            setError(null);
          }}
          placeholder="Repeat your password"
          iconLeft={<Lock size={16} aria-hidden="true" />}
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          aria-describedby={
            error?.field === 'confirmPassword' ? 'password-recovery-error' : undefined
          }
          invalid={error?.field === 'confirmPassword'}
        />
      </div>
      {error ? (
        <div id="password-recovery-error" role="alert" aria-live="polite">
          <FormError message={error.message} />
        </div>
      ) : null}
      <Button type="submit" className="w-full" loading={isPending}>
        {isPending ? 'Saving…' : 'Update password'}
      </Button>
    </form>
  );
}
