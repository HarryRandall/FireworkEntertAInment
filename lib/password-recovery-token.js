const IMPLICIT_RECOVERY_TOKEN_HASH = /^[a-f0-9]{56}$/;

/**
 * Match the SHA-224 token hash emitted by Supabase's implicit recovery flow.
 * @param {unknown} value
 * @returns {value is string}
 */
export function isValidPasswordRecoveryTokenHash(value) {
  return typeof value === 'string' && IMPLICIT_RECOVERY_TOKEN_HASH.test(value);
}
