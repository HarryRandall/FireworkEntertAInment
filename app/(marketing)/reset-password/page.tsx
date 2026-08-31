/** Reset-password page; exposes the form only after a verified recovery exchange. */

import Link from 'next/link';
import { FormError } from '@/components/design-system/FormError';
import { getPasswordRecoverySession } from '@/lib/password-recovery.server';
import { ResetPasswordForm } from './ResetPasswordForm';
import { ResetPasswordShell } from './ResetPasswordShell';

export const dynamic = 'force-dynamic';

type ResetPasswordPageProps = {
  searchParams: Promise<{ error?: string | string[] }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams;
  const callbackError = Array.isArray(params.error) ? params.error[0] : params.error;
  const recovery = callbackError ? null : await getPasswordRecoverySession();
  const errorMessage =
    callbackError === 'recovery_rate_limited'
      ? 'Too many reset attempts were made. Wait a few minutes, then request a new link.'
      : callbackError === 'recovery_unavailable'
        ? 'Password recovery is temporarily unavailable. Please try again later.'
        : 'This reset link has expired or already been used. Request a new one.';

  return (
    <ResetPasswordShell>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-[color:var(--color-content-emphasis)]">
          Set a new password
        </h1>
        <p className="text-sm text-[color:var(--color-content-subtle)]">
          Pick a strong password you don&apos;t use anywhere else.
        </p>
      </div>

      {recovery ? (
        <ResetPasswordForm />
      ) : (
        <div className="space-y-3">
          <div role="alert" aria-live="polite">
            <FormError message={errorMessage} />
          </div>
          <Link
            href="/forgot-password"
            className="block text-sm font-medium text-[color:var(--color-content-emphasis)] hover:underline"
          >
            Request a new reset link
          </Link>
        </div>
      )}
    </ResetPasswordShell>
  );
}
