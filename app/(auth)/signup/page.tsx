'use client';

/** Signup page (Supabase email/password sign-up). */

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { Mail, Lock, User, CheckCircle, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/design-system/Input';
import { Button } from '@/components/design-system/Button';
import { createClient } from '@/utils/supabase/client';
import { AuthShell } from '../components/AuthShell';
import { FormError } from '@/components/design-system/FormError';
import {
  buildAuthCallbackUrl,
  buildAuthPageHref,
  getAuthCallbackDestination,
} from '@/lib/auth-redirect';

type Step = 'email' | 'details' | 'confirm';
type SignupErrorField = 'email' | 'fullName' | 'password' | 'confirmPassword';
type SignupError = {
  message: string;
  field: SignupErrorField | null;
};

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
  const [error, setError] = useState<SignupError | null>(null);
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
    setStep('details');
  };

  const handleSignUp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    if (!fullName.trim()) {
      setError({ message: 'Please enter your full name.', field: 'fullName' });
      const fullNameInput = form.elements.namedItem('fullName');
      if (fullNameInput instanceof HTMLInputElement) fullNameInput.focus();
      return;
    }
    if (password.length < 8) {
      setError({ message: 'Password must be at least 8 characters.', field: 'password' });
      const passwordInput = form.elements.namedItem('password');
      if (passwordInput instanceof HTMLInputElement) passwordInput.focus();
      return;
    }
    if (password !== confirmPassword) {
      setError({ message: 'Passwords do not match.', field: 'confirmPassword' });
      const confirmPasswordInput = form.elements.namedItem('confirmPassword');
      if (confirmPasswordInput instanceof HTMLInputElement) confirmPasswordInput.focus();
      return;
    }
    setLoading(true);
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName.trim() },
          emailRedirectTo: buildAuthCallbackUrl(window.location.origin, nextPath),
        },
      });
      if (signUpError) {
        setError({ message: signUpError.message, field: null });
        return;
      }
      setStep('confirm');
    } catch (signUpError) {
      console.error('[auth] sign-up failed:', signUpError);
      setError({
        message: 'Could not create your account. Check your connection and try again.',
        field: null,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      {step === 'confirm' ? (
        <div className="space-y-5 text-center" role="status" aria-live="polite">
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--color-border-subtle)] bg-[color:var(--color-status-success-subtle)] text-[color:var(--color-status-success)]">
            <CheckCircle size={22} strokeWidth={1.8} aria-hidden="true" />
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
                  iconLeft={<Mail size={16} aria-hidden="true" />}
                  autoComplete="email"
                  spellCheck={false}
                  aria-describedby={error?.field === 'email' ? 'signup-email-error' : undefined}
                  invalid={error?.field === 'email'}
                />
              </div>
              {error ? (
                <div id="signup-email-error" role="alert" aria-live="polite">
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
                    iconLeft={<User size={16} aria-hidden="true" />}
                    autoComplete="name"
                    aria-describedby={
                      error?.field === 'fullName' ? 'signup-details-error' : undefined
                    }
                    invalid={error?.field === 'fullName'}
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
                    iconLeft={<Lock size={16} aria-hidden="true" />}
                    autoComplete="new-password"
                    aria-describedby={
                      error?.field === 'password' ? 'signup-details-error' : undefined
                    }
                    minLength={8}
                    maxLength={128}
                    invalid={error?.field === 'password'}
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
                    iconLeft={<Lock size={16} aria-hidden="true" />}
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={128}
                    aria-describedby={
                      error?.field === 'confirmPassword' ? 'signup-details-error' : undefined
                    }
                    invalid={error?.field === 'confirmPassword'}
                  />
                </div>
                {error ? (
                  <div id="signup-details-error" role="alert" aria-live="polite">
                    <FormError message={error.message} />
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
