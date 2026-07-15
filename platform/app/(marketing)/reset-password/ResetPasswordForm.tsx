'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { Lock } from 'lucide-react';
import { updateRecoveredPasswordAction } from '@/app/actions/password-recovery';
import { Button } from '@/app/components/ui/Button';
import { FormError } from '@/app/components/ui/FormError';
import { Input } from '@/app/components/ui/Input';

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password.length > 128) {
      setError('Password is too long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    startTransition(async () => {
      try {
        const result = await updateRecoveredPasswordAction({ password, confirmPassword });
        if (!result.ok) {
          setError(result.error);
          return;
        }

        router.replace('/home');
        router.refresh();
      } catch (actionError) {
        console.error('[password-recovery] action failed:', actionError);
        setError('Could not update your password. Please try again.');
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
          iconLeft={<Lock size={16} />}
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          aria-describedby={error ? 'password-recovery-error' : undefined}
          invalid={Boolean(error)}
          autoFocus
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
          iconLeft={<Lock size={16} />}
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          aria-describedby={error ? 'password-recovery-error' : undefined}
          invalid={Boolean(error)}
        />
      </div>
      {error ? (
        <div id="password-recovery-error" role="alert" aria-live="polite">
          <FormError message={error} />
        </div>
      ) : null}
      <Button type="submit" className="w-full" loading={isPending}>
        {isPending ? 'Saving…' : 'Update password'}
      </Button>
    </form>
  );
}
