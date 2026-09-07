import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { confirmPasswordRecoveryAction } from '@/app/actions/password-recovery';
import { FormError } from '@/ui/patterns/FormError';
import { PASSWORD_RECOVERY_TOKEN_COOKIE } from '@/lib/auth/password-recovery.server';
import { ResetPasswordShell } from '@/app/(marketing)/reset-password/_components/ResetPasswordShell';
import { ConfirmRecoveryButton } from '@/app/(marketing)/reset-password/confirm/_components/ConfirmRecoveryButton';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ConfirmPasswordRecoveryPage() {
  const cookieStore = await cookies();
  const hasPendingToken = Boolean(cookieStore.get(PASSWORD_RECOVERY_TOKEN_COOKIE)?.value);

  return (
    <ResetPasswordShell>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-[color:var(--color-content-emphasis)]">
          Continue password reset
        </h1>
        <p className="text-sm text-[color:var(--color-content-subtle)]">
          Confirm that you want to use this one-time link. Your password will not change until you
          choose a new one on the next screen.
        </p>
      </div>

      {hasPendingToken ? (
        <form action={confirmPasswordRecoveryAction}>
          <ConfirmRecoveryButton />
        </form>
      ) : (
        <div className="space-y-3">
          <div role="alert" aria-live="polite">
            <FormError message="This reset link has expired or already been used. Request a new one." />
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
