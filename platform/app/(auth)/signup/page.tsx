'use client';

/** Signup page (Supabase email/password sign-up). */

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Mail, Lock, User, CheckCircle, ArrowLeft } from 'lucide-react';
import { Input } from '@/app/components/ui/Input';
import { Button } from '@/app/components/ui/Button';
import { createClient } from '@/utils/supabase/client';
import { AuthShell } from '../components/AuthShell';
import { FormError } from '@/app/components/ui/FormError';

type Step = 'email' | 'details' | 'confirm';

export default function SignupPage() {
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
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
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
        emailRedirectTo: `${window.location.origin}/auth/callback`,
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
        <div className="space-y-5 text-center">
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
          </div>
          <p className="text-sm text-[color:var(--color-content-subtle)]">
            Already confirmed?{' '}
            <Link
              href="/login"
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
                    type="text"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      setError(null);
                    }}
                    placeholder="Your full name"
                    iconLeft={<User size={16} />}
                    autoComplete="name"
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
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null);
                    }}
                    placeholder="Create a password"
                    iconLeft={<Lock size={16} />}
                    autoComplete="new-password"
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
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setError(null);
                    }}
                    placeholder="Repeat your password"
                    iconLeft={<Lock size={16} />}
                    autoComplete="new-password"
                  />
                </div>
                {error && <FormError message={error} />}
                <Button type="submit" className="w-full" loading={loading}>
                  {loading ? 'Creating account…' : 'Create account'}
                </Button>
              </form>
            </div>
          )}

          <p className="text-sm text-[color:var(--color-content-subtle)]">
            Already have an account?{' '}
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
