import 'server-only';

import { cookies } from 'next/headers';
import {
  createPasswordRecoveryProof,
  PASSWORD_RECOVERY_PROOF_TTL_SECONDS,
  verifyPasswordRecoveryProof,
} from '@/lib/password-recovery-proof';
import { createClient } from '@/utils/supabase/server';

export const PASSWORD_RECOVERY_COOKIE = 'showcrafter_password_recovery';
export const PASSWORD_RECOVERY_TOKEN_COOKIE = 'showcrafter_password_recovery_token';
export const PASSWORD_RECOVERY_TTL_SECONDS = PASSWORD_RECOVERY_PROOF_TTL_SECONDS;

type CookieStore = Awaited<ReturnType<typeof cookies>>;

export function passwordRecoveryCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/reset-password',
    maxAge: PASSWORD_RECOVERY_TTL_SECONDS,
  };
}

export function passwordRecoveryTokenCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/reset-password/confirm',
    maxAge: PASSWORD_RECOVERY_TTL_SECONDS,
  };
}

export function clearPasswordRecoveryCookie(cookieStore: CookieStore) {
  cookieStore.set(PASSWORD_RECOVERY_COOKIE, '', {
    ...passwordRecoveryCookieOptions(),
    maxAge: 0,
  });
}

export function clearPasswordRecoveryTokenCookie(cookieStore: CookieStore) {
  cookieStore.set(PASSWORD_RECOVERY_TOKEN_COOKIE, '', {
    ...passwordRecoveryTokenCookieOptions(),
    maxAge: 0,
  });
}

function passwordRecoverySigningSecret() {
  const secret = process.env.PASSWORD_RECOVERY_SIGNING_SECRET?.trim();
  return secret && secret.length >= 32 ? secret : null;
}

export function issuePasswordRecoveryProof(userId: string) {
  const secret = passwordRecoverySigningSecret();
  if (!secret) return null;
  return createPasswordRecoveryProof({ userId, secret });
}

/**
 * A normal signed-in session is insufficient for password recovery. The
 * callback records which user completed the recovery exchange, and every
 * render or mutation checks that the current Supabase user still matches.
 */
export async function getPasswordRecoverySession() {
  const cookieStore = await cookies();
  const secret = passwordRecoverySigningSecret();
  const proof = verifyPasswordRecoveryProof({
    proof: cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value,
    secret: secret ?? '',
  });
  if (!proof) return null;

  const supabase = createClient(cookieStore);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user || user.id !== proof.userId) return null;

  return { cookieStore, supabase, userId: user.id };
}
