'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getTrustedAppOrigin } from '@/lib/app-origin';
import { sendPasswordRecoveryEmail } from '@/lib/password-recovery-email.server';
import {
  reservePasswordRecoveryEmailRequest,
  reservePasswordRecoveryVerification,
} from '@/lib/password-recovery-rate-limit.server';
import {
  clearPasswordRecoveryCookie,
  clearPasswordRecoveryTokenCookie,
  getPasswordRecoverySession,
  issuePasswordRecoveryProof,
  PASSWORD_RECOVERY_COOKIE,
  PASSWORD_RECOVERY_TOKEN_COOKIE,
  passwordRecoveryCookieOptions,
} from '@/lib/password-recovery.server';
import { isValidPasswordRecoveryTokenHash } from '@/lib/password-recovery-token';
import { createClient } from '@/utils/supabase/server';

const PasswordRecoveryEmailSchema = z.string().trim().email().max(320);

const PasswordRecoverySchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters.')
      .max(128, 'Password is too long.'),
    confirmPassword: z.string(),
  })
  .refine((input) => input.password === input.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

export type PasswordRecoveryResult = { ok: true } | { ok: false; error: string };

export async function requestPasswordRecoveryAction(
  email: string,
): Promise<PasswordRecoveryResult> {
  const parsed = PasswordRecoveryEmailSchema.safeParse(email);
  if (!parsed.success) return { ok: false, error: 'Please enter a valid email address.' };

  const appOrigin = getTrustedAppOrigin();
  if (!appOrigin) {
    console.error('[password-recovery] APP_ORIGIN is not configured.');
    return { ok: false, error: 'Password recovery is not available right now.' };
  }

  const allowance = await reservePasswordRecoveryEmailRequest(parsed.data);
  if (!allowance.ok) {
    console.error(`[password-recovery] email request blocked: ${allowance.reason}`);
    if (allowance.reason === 'unavailable') {
      return { ok: false, error: 'Password recovery is not available right now.' };
    }
    return { ok: true };
  }

  const result = await sendPasswordRecoveryEmail(parsed.data, appOrigin);
  if (!result.ok) {
    console.error('[password-recovery] reset email failed:', result.error);
  }

  return { ok: true };
}

export async function confirmPasswordRecoveryAction(): Promise<never> {
  const cookieStore = await cookies();
  const tokenHash = cookieStore.get(PASSWORD_RECOVERY_TOKEN_COOKIE)?.value;
  clearPasswordRecoveryTokenCookie(cookieStore);

  if (!isValidPasswordRecoveryTokenHash(tokenHash)) {
    redirect('/reset-password?error=invalid_recovery_link');
  }

  const allowance = await reservePasswordRecoveryVerification(tokenHash);
  if (!allowance.ok) {
    redirect(
      allowance.reason === 'rate_limited'
        ? '/reset-password?error=recovery_rate_limited'
        : '/reset-password?error=recovery_unavailable',
    );
  }

  const supabase = createClient(cookieStore);
  let verifiedUserId: string | null = null;

  try {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'recovery',
    });
    if (error || !data.user || !data.session) {
      if (error) console.error('[password-recovery] token verification failed:', error);
    } else {
      verifiedUserId = data.user.id;
    }
  } catch (error) {
    console.error('[password-recovery] token verification threw:', error);
  }

  if (!verifiedUserId) {
    redirect('/reset-password?error=invalid_recovery_link');
  }

  const proof = issuePasswordRecoveryProof(verifiedUserId);
  if (proof) {
    let proofWritten = false;
    try {
      cookieStore.set(PASSWORD_RECOVERY_COOKIE, proof, passwordRecoveryCookieOptions());
      proofWritten = true;
    } catch (error) {
      console.error('[password-recovery] recovery proof write failed:', error);
    }
    if (proofWritten) redirect('/reset-password');
  } else {
    console.error('[password-recovery] password recovery signing secret is not configured.');
  }

  const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
  if (signOutError) console.error('[password-recovery] failed recovery sign-out:', signOutError);
  redirect('/reset-password?error=invalid_recovery_link');
}

export async function updateRecoveredPasswordAction(input: {
  password: string;
  confirmPassword: string;
}): Promise<PasswordRecoveryResult> {
  const parsed = PasswordRecoverySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Check the password details.',
    };
  }

  const recovery = await getPasswordRecoverySession();
  if (!recovery) {
    return {
      ok: false,
      error: 'This reset link has expired or already been used. Request a new one.',
    };
  }

  const { error } = await recovery.supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    console.error('[password-recovery] password update failed:', error);
    return { ok: false, error: 'Could not update your password. Please try again.' };
  }

  clearPasswordRecoveryCookie(recovery.cookieStore);
  return { ok: true };
}
