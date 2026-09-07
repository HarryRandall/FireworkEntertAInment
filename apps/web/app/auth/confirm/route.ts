import { NextResponse } from 'next/server';
import {
  PASSWORD_RECOVERY_COOKIE,
  PASSWORD_RECOVERY_TOKEN_COOKIE,
  passwordRecoveryCookieOptions,
  passwordRecoveryTokenCookieOptions,
} from '@/lib/password-recovery.server';
import { isValidPasswordRecoveryTokenHash } from '@/lib/password-recovery-token';

function noStoreRedirect(url: URL) {
  const response = NextResponse.redirect(url);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}

function recoveryFailure(origin: string) {
  const response = noStoreRedirect(new URL('/reset-password?error=invalid_recovery_link', origin));
  response.cookies.set(PASSWORD_RECOVERY_TOKEN_COOKIE, '', {
    ...passwordRecoveryTokenCookieOptions(),
    maxAge: 0,
  });
  return response;
}

/** Move the one-time token out of the URL without consuming it on an email prefetch. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');

  if (!isValidPasswordRecoveryTokenHash(tokenHash) || type !== 'recovery') {
    return recoveryFailure(origin);
  }

  const response = noStoreRedirect(new URL('/reset-password/confirm', origin));
  response.cookies.set(PASSWORD_RECOVERY_TOKEN_COOKIE, tokenHash, {
    ...passwordRecoveryTokenCookieOptions(),
  });
  response.cookies.set(PASSWORD_RECOVERY_COOKIE, '', {
    ...passwordRecoveryCookieOptions(),
    maxAge: 0,
  });
  return response;
}
