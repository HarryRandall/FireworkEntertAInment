'use client';

/** Forgot-password page; sends a Supabase password recovery email. */

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Mail, CheckCircle, Sparkles } from 'lucide-react';
import { requestPasswordRecoveryAction } from '@/app/actions/password-recovery';
import { Input } from '@/app/components/ui/Input';
import { Button } from '@/app/components/ui/Button';
import { FormError } from '@/app/components/ui/FormError';

type ForgotPasswordError = {
  message: string;
  field: 'email' | null;
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<ForgotPasswordError | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError({ message: 'Please enter a valid email address.', field: 'email' });
      const emailInput = e.currentTarget.elements.namedItem('email');
      if (emailInput instanceof HTMLInputElement) emailInput.focus();
      return;
    }
    setLoading(true);
    try {
      const result = await requestPasswordRecoveryAction(email);
      if (!result.ok) {
        setError({ message: result.error, field: null });
        return;
      }
      setSent(true);
    } catch (requestError) {
      console.error('[password-recovery] request failed:', requestError);
      setError({
        message: 'Could not request a reset link. Check your connection and try again.',
        field: null,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      {sent ? (
        <div className="space-y-5 text-center" role="status" aria-live="polite">
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--color-border-subtle)] bg-[color:var(--color-status-success-subtle)] text-[color:var(--color-status-success)]">
            <CheckCircle size={22} strokeWidth={1.8} aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-[color:var(--color-content-emphasis)]">
              Check your inbox
            </h1>
            <p className="text-sm text-[color:var(--color-content-subtle)]">
              If an account exists for{' '}
              <span className="font-medium text-[color:var(--color-content-emphasis)]">
                {email}
              </span>
              , a password reset link may arrive shortly. Follow the link to continue.
            </p>
            <p className="mt-2 text-xs text-[color:var(--color-content-muted)]">
              The link is single-use. If it expires, request another one here.
            </p>
          </div>
          <p className="text-sm text-[color:var(--color-content-subtle)]">
            <Link
              href="/login"
              className="font-medium text-[color:var(--color-content-emphasis)] hover:underline"
            >
              Back to sign in
            </Link>
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-[color:var(--color-content-emphasis)]">
              Reset your password
            </h1>
            <p className="text-sm text-[color:var(--color-content-subtle)]">
              Enter the email associated with your ShowCrafter account to request a reset link.
            </p>
          </div>
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-[color:var(--color-content-emphasis)]"
              >
                Email address
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                placeholder="you@example.com"
                iconLeft={<Mail size={16} aria-hidden="true" />}
                autoComplete="email"
                spellCheck={false}
                aria-describedby={
                  error?.field === 'email' ? 'forgot-password-email-error' : undefined
                }
                invalid={error?.field === 'email'}
              />
            </div>
            {error ? (
              <div id="forgot-password-email-error" role="alert" aria-live="polite">
                <FormError message={error.message} />
              </div>
            ) : null}
            <Button type="submit" className="w-full" loading={loading}>
              {loading ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>
          <p className="text-sm text-[color:var(--color-content-subtle)]">
            Remembered it?{' '}
            <Link
              href="/login"
              className="font-medium text-[color:var(--color-content-emphasis)] hover:underline"
            >
              Sign in
            </Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[color:var(--color-bg-muted)] px-4 py-12">
      <Link
        href="/"
        className="mb-8 flex items-center gap-2 text-sm font-semibold tracking-tight text-[color:var(--color-content-emphasis)]"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[color:var(--color-content-emphasis)] text-[color:var(--color-content-inverted)]">
          <Sparkles size={14} strokeWidth={2.2} aria-hidden="true" />
        </span>
        ShowCrafter
      </Link>
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)] p-8 shadow-[var(--shadow-card)]">
        {children}
      </div>
    </div>
  );
}
