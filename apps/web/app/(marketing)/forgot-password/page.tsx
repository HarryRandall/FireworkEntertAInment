'use client';

/** Forgot-password page; sends a Supabase password recovery email. */

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Mail, CheckCircle } from 'lucide-react';
import { requestPasswordRecoveryAction } from '@/lib/auth/password-recovery-actions.server';
import { BrandLockup } from '@/ui/patterns/BrandMark';
import { Input } from '@/ui/patterns/Input';
import { Button } from '@/ui/patterns/Button';
import { FormError } from '@/ui/patterns/FormError';

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
          <div className="border-border bg-status-success-subtle text-status-success mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full border">
            <CheckCircle size={22} strokeWidth={1.8} aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h1 className="text-foreground text-xl font-semibold tracking-tight">
              Check your inbox
            </h1>
            <p className="text-muted-foreground text-sm">
              If an account exists for <span className="text-foreground font-medium">{email}</span>,
              a password reset link may arrive shortly. Follow the link to continue.
            </p>
            <p className="text-muted-foreground mt-2 text-xs">
              The link is single-use. If it expires, request another one here.
            </p>
          </div>
          <p className="text-muted-foreground text-sm">
            <Link href="/login" className="text-foreground font-medium hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-1">
            <h1 className="text-foreground text-xl font-semibold tracking-tight">
              Reset your password
            </h1>
            <p className="text-muted-foreground text-sm">
              Enter the email associated with your ShowCrafter account to request a reset link.
            </p>
          </div>
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-foreground block text-sm font-medium">
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
          <p className="text-muted-foreground text-sm">
            Remembered it?{' '}
            <Link href="/login" className="text-foreground font-medium hover:underline">
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
    <div className="bg-muted flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="text-foreground mb-8">
        <BrandLockup />
      </Link>
      <div className="border-border bg-card w-full max-w-sm space-y-6 rounded-xl border p-8 shadow-[var(--shadow-card)]">
        {children}
      </div>
    </div>
  );
}
