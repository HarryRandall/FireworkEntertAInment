'use client';

/** Forgot-password page; sends a Supabase password recovery email. */

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Mail, CheckCircle, Sparkles } from 'lucide-react';
import { Input } from '@/app/components/ui/Input';
import { Button } from '@/app/components/ui/Button';
import { createClient } from '@/utils/supabase/client';
import { FormError } from '../components/FormError';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const supabase = createClient();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setSent(true);
    setLoading(false);
  };

  return (
    <AuthShell>
      {sent ? (
        <div className="space-y-5 text-center">
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--color-border-subtle)] bg-[color:var(--color-status-success-subtle)] text-[color:var(--color-status-success)]">
            <CheckCircle size={22} strokeWidth={1.8} />
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
              , we&apos;ve sent a password reset link. The link expires in 1 hour.
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
              Enter the email associated with your ShowCrafter account and we&apos;ll send you a
              reset link.
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
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                placeholder="you@example.com"
                iconLeft={<Mail size={16} />}
                autoComplete="email"
                autoFocus
              />
            </div>
            {error && <FormError message={error} />}
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
          <Sparkles size={14} strokeWidth={2.2} />
        </span>
        ShowCrafter
      </Link>
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)] p-8 shadow-[var(--shadow-card)]">
        {children}
      </div>
    </div>
  );
}
