'use client';

/** Login page (Supabase email/password sign-in). */

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { Mail, Lock, ArrowLeft } from 'lucide-react';
import { Input } from '@/app/components/ui/Input';
import { Button } from '@/app/components/ui/Button';
import { createClient } from '@/utils/supabase/client';
import { AuthShell } from '../components/AuthShell';
import { FormError } from '@/app/components/ui/FormError';

type Step = 'email' | 'password';

function getSafeNextPath(nextPath: string) {
  return nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/home';
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') || '/home';

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    setStep('password');
  };

  const handleSignIn = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!password) {
      setError('Please enter your password.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      const dest = getSafeNextPath(nextPath);
      window.location.replace(dest);
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
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                placeholder="••••••••"
                iconLeft={<Lock size={16} />}
                autoComplete="current-password"
                autoFocus
              />
            </div>
            {error && <FormError message={error} />}
            <Button type="submit" className="w-full" loading={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>
      )}

      <p className="text-sm text-[color:var(--color-content-subtle)]">
        No account?{' '}
        <Link
          href="/signup"
          className="font-medium text-[color:var(--color-content-emphasis)] hover:underline"
        >
          Create one free
        </Link>
      </p>
    </AuthShell>
  );
}
