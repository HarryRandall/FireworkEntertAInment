const STALE_AUTH_ERROR_CODES = new Set([
  'bad_jwt',
  'refresh_token_already_used',
  'refresh_token_not_found',
  'session_expired',
  'session_not_found',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isStaleSupabaseAuthError(error: unknown): boolean {
  if (!isRecord(error)) return false;

  const code = typeof error.code === 'string' ? error.code : null;
  if (code && STALE_AUTH_ERROR_CODES.has(code)) return true;

  const status = typeof error.status === 'number' ? error.status : null;
  const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
  return (
    status === 400 &&
    (message.includes('invalid refresh token') || message.includes('refresh token is not valid'))
  );
}
