/** Kit-based forms for password, email-link and anonymous-account authentication. */
'use client';
import { useState } from 'react';
import { Field } from '@/ui/kit/field';
import { Input } from '@/ui/primitives/input';
import { Button } from '@/ui/primitives/button';
import { useAuthForm } from './use-auth-form';
import type { AuthOperation } from '@/lib/auth/browser';
type Mode = 'sign-in' | 'reset-password' | 'upgrade';
const modes: Record<
  Mode,
  { operation: AuthOperation; label: string; passwordLabel: string; autoComplete: string }
> = {
  'sign-in': {
    operation: 'password',
    label: 'Sign in',
    passwordLabel: 'Password',
    autoComplete: 'current-password',
  },
  'reset-password': {
    operation: 'update-password',
    label: 'Save password',
    passwordLabel: 'New password',
    autoComplete: 'new-password',
  },
  upgrade: {
    operation: 'upgrade',
    label: 'Send account link',
    passwordLabel: '',
    autoComplete: 'off',
  },
};
/** Preserves input and reports provider failures while preventing duplicate submissions. */
export function AuthForm({ mode, next = '/auth/continue' }: { mode: Mode; next?: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { pending, message, failed, submit } = useAuthForm(next);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit(modes[mode].operation, email, password);
      }}
      className="grid gap-4"
    >
      {mode !== 'reset-password' && (
        <Field id="email" label="Email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
            disabled={pending}
          />
        </Field>
      )}
      {mode !== 'upgrade' && (
        <Field id="password" label={modes[mode].passwordLabel}>
          <Input
            id="password"
            type="password"
            autoComplete={modes[mode].autoComplete}
            required
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
            }}
            disabled={pending}
          />
        </Field>
      )}
      <Button disabled={pending} type="submit">
        {pending ? 'Please wait...' : modes[mode].label}
      </Button>
      {mode === 'sign-in' && (
        <EmailAlternatives
          disabled={pending || email.length === 0}
          onMagic={() => {
            submit('magic', email, password);
          }}
          onReset={() => {
            submit('reset', email, password);
          }}
        />
      )}
      <p
        role={failed ? 'alert' : 'status'}
        className={failed ? 'text-destructive text-sm' : 'text-muted-foreground text-sm'}
      >
        {message}
      </p>
    </form>
  );
}
function EmailAlternatives({
  disabled,
  onMagic,
  onReset,
}: {
  disabled: boolean;
  onMagic: () => void;
  onReset: () => void;
}) {
  return (
    <>
      <Button type="button" variant="outline" disabled={disabled} onClick={onMagic}>
        Send magic link
      </Button>
      <Button type="button" variant="ghost" disabled={disabled} onClick={onReset}>
        Reset password
      </Button>
    </>
  );
}
