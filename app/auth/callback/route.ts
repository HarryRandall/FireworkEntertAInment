/** Supabase OAuth callback handler that exchanges the auth `code` for a session cookie and redirects the user. */

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  buildAuthCallbackFailureHref,
  getAuthCallbackDestination,
  getSafeAuthNextPath,
  isPasswordRecoveryPath,
} from '@/lib/auth-redirect';
import {
  PASSWORD_RECOVERY_COOKIE,
  passwordRecoveryCookieOptions,
} from '@/lib/password-recovery.server';
import { createClient } from '@/utils/supabase/server';

function noStoreRedirect(url: URL) {
  const response = NextResponse.redirect(url);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

function clearRecoveryProof(response: NextResponse) {
  response.cookies.set(PASSWORD_RECOVERY_COOKIE, '', {
    ...passwordRecoveryCookieOptions(),
    maxAge: 0,
  });
}

function callbackFailure(origin: string, safeNext: string) {
  const response = noStoreRedirect(new URL(buildAuthCallbackFailureHref(safeNext), origin));
  clearRecoveryProof(response);
  return response;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const safeNext = getSafeAuthNextPath(searchParams.get('next'));

  if (!code || isPasswordRecoveryPath(safeNext)) return callbackFailure(origin, safeNext);

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.user || !data.session) {
      if (error) console.error('[auth-callback] code exchange failed:', error);
      return callbackFailure(origin, safeNext);
    }

    const destination = getAuthCallbackDestination(safeNext);
    const response = noStoreRedirect(new URL(destination, origin));
    clearRecoveryProof(response);
    return response;
  } catch (error) {
    console.error('[auth-callback] code exchange threw:', error);
    return callbackFailure(origin, safeNext);
  }
}
