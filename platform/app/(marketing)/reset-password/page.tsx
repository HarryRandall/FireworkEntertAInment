'use client';

/** Reset-password page; completes the Supabase password recovery flow. */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { Input } from '@/app/components/ui/Input';
import { Button } from '@/app/components/ui/Button';
import { createClient } from '@/utils/supabase/client';
import { FormError } from '@/app/components/ui/FormError';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setHasSession(Boolean(data.user));
    });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push('/dashboard');
    router.refresh();
  };

  return (
    <AuthShell>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-[color:var(--color-content-emphasis)]">
          Set a new password
        </h1>
        <p className="text-sm text-[color:var(--color-content-subtle)]">
          Pick a strong password you don&apos;t use anywhere else.
        </p>
      </div>

      {hasSession === false ? (
        <div className="space-y-3">
          <FormError message="This reset link has expired or already been used. Request a new one." />
          <Link
            href="/forgot-password"
            className="block text-sm font-medium text-[color:var(--color-content-emphasis)] hover:underline"
          >
            Request a new reset link
          </Link>
        </div>
      ) : (
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
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              placeholder="At least 6 characters"
              iconLeft={<Lock size={16} />}
              autoComplete="new-password"
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
          <Button type="submit" className="w-full" loading={loading} disabled={hasSession === null}>
            {loading ? 'Saving…' : 'Update password'}
          </Button>
        </form>
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
