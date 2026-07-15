'use client';

/** Signup page (Supabase email/password sign-up). */

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { Mail, Lock, User, CheckCircle, ArrowLeft } from 'lucide-react';
import { Input } from '@/app/components/ui/Input';
import { Button } from '@/app/components/ui/Button';
import { createClient } from '@/utils/supabase/client';
import { AuthShell } from '../components/AuthShell';
import { FormError } from '@/app/components/ui/FormError';
import {
  buildAuthCallbackUrl,
  buildAuthPageHref,
  getAuthCallbackDestination,
} from '@/lib/auth-redirect';

type Step = 'email' | 'details' | 'confirm';

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupPageFallback />}>
      <SignupPageInner />
    </Suspense>
  );
}

function SignupPageFallback() {
  return (
    <AuthShell>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-[color:var(--color-content-emphasis)]">
          Create your account
        </h1>
        <p
          className="text-sm text-[color:var(--color-content-subtle)]"
          role="status"
          aria-live="polite"
        >
          Preparing account creation…
        </p>
      </div>
    </AuthShell>
  );
}

function SignupPageInner() {
  const searchParams = useSearchParams();
  const nextPath = getAuthCallbackDestination(searchParams.get('next'));
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  const handleEmailContinue = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    setStep('details');
  };

  const handleSignUp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: buildAuthCallbackUrl(window.location.origin, nextPath),
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setStep('confirm');
    }
  };

  return (
    <AuthShell>
      {step === 'confirm' ? (
        <div className="space-y-5 text-center" role="status" aria-live="polite">
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--color-border-subtle)] bg-[color:var(--color-status-success-subtle)] text-[color:var(--color-status-success)]">
            <CheckCircle size={22} strokeWidth={1.8} />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-[color:var(--color-content-emphasis)]">
              Check your inbox
            </h1>
            <p className="text-sm text-[color:var(--color-content-subtle)]">
              We sent a confirmation link to{' '}
              <span className="font-medium text-[color:var(--color-content-emphasis)]">
                {email}
              </span>
              . Click it to activate your account.
            </p>
            <p className="mt-2 text-xs text-[color:var(--color-content-muted)]">
              For security, open the link in this browser on this device.
            </p>
          </div>
          <p className="text-sm text-[color:var(--color-content-subtle)]">
            Already confirmed?{' '}
            <Link
              href={buildAuthPageHref('/login', nextPath)}
              className="font-medium text-[color:var(--color-content-emphasis)] hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-[color:var(--color-content-emphasis)]">
              {step === 'email' ? 'Create your account' : 'Almost there'}
            </h1>
            <p className="text-sm text-[color:var(--color-content-subtle)]">
              {step === 'email' ? 'Design your first firework show' : email}
            </p>
          </div>

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
                  iconLeft={<Mail size={16} />}
                  autoComplete="email"
                  spellCheck={false}
                  aria-describedby={error ? 'signup-email-error' : undefined}
                  invalid={Boolean(error)}
                  autoFocus
                />
              </div>
              {error ? (
                <div id="signup-email-error" role="alert" aria-live="polite">
                  <FormError message={error} />
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
                <ArrowLeft size={14} />
                Use a different email
              </button>

              <form onSubmit={handleSignUp} noValidate className="space-y-3">
                <div className="space-y-2">
                  <label
                    htmlFor="fullName"
                    className="block text-sm font-medium text-[color:var(--color-content-emphasis)]"
                  >
                    Full name
                  </label>
                  <Input
                    id="fullName"
                    name="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      setError(null);
                    }}
                    placeholder="Your full name"
                    iconLeft={<User size={16} />}
                    autoComplete="name"
                    aria-describedby={error ? 'signup-details-error' : undefined}
                    invalid={error === 'Please enter your full name.'}
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-[color:var(--color-content-emphasis)]"
                  >
                    Password
                  </label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null);
                    }}
                    placeholder="At least 8 characters"
                    iconLeft={<Lock size={16} />}
                    autoComplete="new-password"
                    aria-describedby={error ? 'signup-details-error' : undefined}
                    minLength={8}
                    maxLength={128}
                    invalid={error === 'Password must be at least 8 characters.'}
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-medium text-[color:var(--color-content-emphasis)]"
                  >
                    Confirm password
                  </label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setError(null);
                    }}
                    placeholder="Repeat your password"
                    iconLeft={<Lock size={16} />}
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={128}
                    aria-describedby={error ? 'signup-details-error' : undefined}
                    invalid={error === 'Passwords do not match.'}
                  />
                </div>
                {error ? (
                  <div id="signup-details-error" role="alert" aria-live="polite">
                    <FormError message={error} />
                  </div>
                ) : null}
                <Button type="submit" className="w-full" loading={loading}>
                  {loading ? 'Creating account…' : 'Create account'}
                </Button>
              </form>
            </div>
          )}

          <p className="text-sm text-[color:var(--color-content-subtle)]">
            Already have an account?{' '}
            <Link
              href={buildAuthPageHref('/login', nextPath)}
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
