/** Shared same-origin redirect helpers for the browser and auth route handlers. */

const AUTH_REDIRECT_BASE = 'https://showcrafter.invalid';
export const DEFAULT_AUTH_NEXT_PATH = '/home';

/**
 * Return a normalised root-relative path, or the app home for unsafe input.
 * Backslashes and control characters are rejected before URL parsing because
 * browsers can reinterpret them while resolving a redirect.
 *
 * @param {string | null | undefined} nextPath
 * @returns {string}
 */
export function getSafeAuthNextPath(nextPath) {
  if (
    typeof nextPath !== 'string' ||
    nextPath.length === 0 ||
    nextPath !== nextPath.trim() ||
    !nextPath.startsWith('/') ||
    nextPath.startsWith('//') ||
    /[\\\u0000-\u001f\u007f]/.test(nextPath)
  ) {
    return DEFAULT_AUTH_NEXT_PATH;
  }

  try {
    const parsed = new URL(nextPath, AUTH_REDIRECT_BASE);
    if (parsed.origin !== AUTH_REDIRECT_BASE) return DEFAULT_AUTH_NEXT_PATH;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return DEFAULT_AUTH_NEXT_PATH;
  }
}

/**
 * Build a login or signup link that carries the validated destination.
 *
 * @param {'/login' | '/signup'} page
 * @param {string | null | undefined} nextPath
 * @returns {string}
 */
export function buildAuthPageHref(page, nextPath) {
  const params = new URLSearchParams({ next: getSafeAuthNextPath(nextPath) });
  return `${page}?${params.toString()}`;
}

/**
 * Build the absolute callback URL Supabase places in an email.
 *
 * @param {string} origin
 * @param {string | null | undefined} nextPath
 * @returns {string}
 */
export function buildAuthCallbackUrl(origin, nextPath) {
  const callbackUrl = new URL('/auth/callback', origin);
  callbackUrl.searchParams.set('next', getAuthCallbackDestination(nextPath));
  return callbackUrl.toString();
}

/**
 * Password recovery is a privileged auth flow, not a general redirect target.
 *
 * @param {string | null | undefined} nextPath
 * @returns {boolean}
 */
export function isPasswordRecoveryPath(nextPath) {
  const parsed = new URL(getSafeAuthNextPath(nextPath), AUTH_REDIRECT_BASE);
  return parsed.pathname === '/reset-password' || parsed.pathname === '/reset-password/';
}

/**
 * Route a successful signup or sign-in exchange. Password recovery uses the
 * dedicated token-hash confirmation route and is rejected by this callback.
 *
 * @param {string | null | undefined} nextPath
 * @returns {string}
 */
export function getAuthCallbackDestination(nextPath) {
  const safeNext = getSafeAuthNextPath(nextPath);
  return isPasswordRecoveryPath(safeNext) ? DEFAULT_AUTH_NEXT_PATH : safeNext;
}

/**
 * Keep failed recovery exchanges on the recovery screen, while other failed
 * confirmation links return to sign-in with their safe destination intact.
 *
 * @param {string | null | undefined} nextPath
 * @returns {string}
 */
export function buildAuthCallbackFailureHref(nextPath) {
  const safeNext = getSafeAuthNextPath(nextPath);
  const isRecovery = isPasswordRecoveryPath(safeNext);
  const params = new URLSearchParams({
    error: isRecovery ? 'invalid_recovery_link' : 'confirmation_failed',
  });
  if (!isRecovery) params.set('next', safeNext);
  return `${isRecovery ? '/reset-password' : '/login'}?${params.toString()}`;
}
