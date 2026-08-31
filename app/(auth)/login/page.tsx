'use client';

/** Login page (Supabase email/password sign-in). */

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { Mail, Lock, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/design-system/Input';
import { Button } from '@/components/design-system/Button';
import { createClient } from '@/utils/supabase/client';
import { AuthShell } from '../components/AuthShell';
import { FormError } from '@/components/design-system/FormError';
import { buildAuthPageHref, getAuthCallbackDestination } from '@/lib/auth-redirect';

type Step = 'email' | 'password';
type LoginError = {
  message: string;
  field: Step | null;
};

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageFallback() {
  return (
    <AuthShell>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-[color:var(--color-content-emphasis)]">
          Welcome back
        </h1>
        <p
          className="text-sm text-[color:var(--color-content-subtle)]"
          role="status"
          aria-live="polite"
        >
          Checking your sign-in link…
        </p>
      </div>
    </AuthShell>
  );
}

function LoginPageInner() {
  const searchParams = useSearchParams();
  const nextPath = getAuthCallbackDestination(searchParams.get('next'));
  const callbackError = searchParams.get('error');
  const accountDeleted = searchParams.get('deleted') === '1';
  const accountSessionCleanupPartial =
    accountDeleted && searchParams.get('session_cleanup') === 'partial';

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<LoginError | null>(() =>
    callbackError === 'confirmation_failed'
      ? {
          message:
            'That confirmation link is invalid or has expired. Sign in if your account is already confirmed.',
          field: null,
        }
      : null,
  );
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  const handleEmailContinue = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError({ message: 'Please enter a valid email address.', field: 'email' });
      const emailInput = e.currentTarget.elements.namedItem('email');
      if (emailInput instanceof HTMLInputElement) emailInput.focus();
      return;
    }
    setStep('password');
  };

  const handleSignIn = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    if (!password) {
      setError({ message: 'Please enter your password.', field: 'password' });
      const passwordInput = form.elements.namedItem('password');
      if (passwordInput instanceof HTMLInputElement) passwordInput.focus();
      return;
    }
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError({ message: signInError.message, field: 'password' });
        const passwordInput = form.elements.namedItem('password');
        if (passwordInput instanceof HTMLInputElement) passwordInput.focus();
        setLoading(false);
        return;
      }
      window.location.replace(nextPath);
    } catch (signInError) {
      console.error('[auth] sign-in failed:', signInError);
      setError({ message: 'Could not sign in. Check your connection and try again.', field: null });
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-[color:var(--color-content-emphasis)]">
          {step === 'email' ? 'Welcome back' : 'Enter your password'}
        </h1>
        <p className="text-sm text-[color:var(--color-content-subtle)]">
          {step === 'email' ? 'Sign in to your ShowCrafter account' : email}
        </p>
      </div>

      {accountDeleted && step === 'email' ? (
        <p
          className={`rounded-md border border-[color:var(--color-border-subtle)] px-3.5 py-2.5 text-sm ${
            accountSessionCleanupPartial
              ? 'bg-[color:var(--color-status-warning-subtle)] text-[color:var(--color-status-warning)]'
              : 'bg-[color:var(--color-status-success-subtle)] text-[color:var(--color-status-success)]'
          }`}
          role={accountSessionCleanupPartial ? 'alert' : 'status'}
        >
          {accountSessionCleanupPartial
            ? 'Your account has been deleted, but complete session cleanup could not be confirmed. Other access tokens may remain valid until they expire.'
            : 'Your account has been deleted and you have been signed out.'}
        </p>
      ) : null}

      {step === 'email' ? (
        <form onSubmit={handleEmailContinue} noValidate className="space-y-4">
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
              aria-describedby={error?.field === 'email' ? 'login-email-error' : undefined}
              invalid={error?.field === 'email'}
            />
          </div>
          {error ? (
            <div id="login-email-error" role="alert" aria-live="polite">
              <FormError message={error.message} />
            </div>
          ) : null}
          <Button type="submit" className="w-full">
            Continue
          </Button>
        </form>
      ) : (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => {
              setStep('email');
              setError(null);
            }}
            className="flex items-center gap-1.5 text-sm text-[color:var(--color-content-subtle)] transition hover:text-[color:var(--color-content-emphasis)]"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Use a different email
          </button>

          <form onSubmit={handleSignIn} noValidate className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-[color:var(--color-content-emphasis)]"
                >
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-[color:var(--color-content-subtle)] hover:text-[color:var(--color-content-emphasis)] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                placeholder="••••••••"
                iconLeft={<Lock size={16} aria-hidden="true" />}
                autoComplete="current-password"
                aria-describedby={error?.field === 'password' ? 'login-password-error' : undefined}
                invalid={error?.field === 'password'}
              />
            </div>
            {error ? (
              <div id="login-password-error" role="alert" aria-live="polite">
                <FormError message={error.message} />
              </div>
            ) : null}
            <Button type="submit" className="w-full" loading={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>
      )}

      <p className="text-sm text-[color:var(--color-content-subtle)]">
        No account?{' '}
        <Link
          href={buildAuthPageHref('/signup', nextPath)}
          className="font-medium text-[color:var(--color-content-emphasis)] hover:underline"
        >
          Create one free
        </Link>
      </p>
    </AuthShell>
  );
}
