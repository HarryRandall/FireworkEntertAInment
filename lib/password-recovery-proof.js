/** Short-lived signed proof issued only after a password-recovery callback. */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const PASSWORD_RECOVERY_PROOF_TTL_SECONDS = 15 * 60;
const PROOF_VERSION = 1;
const SIGNING_CONTEXT = 'showcrafter-password-recovery-v1';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function signatureFor(payload, secret) {
  return createHmac('sha256', secret).update(`${SIGNING_CONTEXT}.${payload}`).digest('base64url');
}

function validSecret(secret) {
  return typeof secret === 'string' && secret.length >= 32;
}

/**
 * @param {{ userId: string, secret: string, nowSeconds?: number, nonce?: string }} input
 * @returns {string | null}
 */
export function createPasswordRecoveryProof({
  userId,
  secret,
  nowSeconds = Math.floor(Date.now() / 1000),
  nonce = randomBytes(18).toString('base64url'),
}) {
  if (!UUID_PATTERN.test(userId) || !validSecret(secret) || !nonce) return null;

  const payload = Buffer.from(
    JSON.stringify({
      v: PROOF_VERSION,
      sub: userId,
      iat: nowSeconds,
      exp: nowSeconds + PASSWORD_RECOVERY_PROOF_TTL_SECONDS,
      nonce,
    }),
  ).toString('base64url');

  return `${payload}.${signatureFor(payload, secret)}`;
}

/**
 * @param {{ proof: string | null | undefined, secret: string, nowSeconds?: number }} input
 * @returns {{ userId: string, expiresAt: number } | null}
 */
export function verifyPasswordRecoveryProof({
  proof,
  secret,
  nowSeconds = Math.floor(Date.now() / 1000),
}) {
  if (typeof proof !== 'string' || !validSecret(secret)) return null;

  const parts = proof.split('.');
  if (parts.length !== 2) return null;
  const [payload, receivedSignature] = parts;
  if (!payload || !receivedSignature) return null;

  const expectedSignature = signatureFor(payload, secret);
  const receivedBuffer = Buffer.from(receivedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (
      typeof value !== 'object' ||
      value === null ||
      value.v !== PROOF_VERSION ||
      typeof value.sub !== 'string' ||
      !UUID_PATTERN.test(value.sub) ||
      typeof value.iat !== 'number' ||
      typeof value.exp !== 'number' ||
      typeof value.nonce !== 'string' ||
      !value.nonce ||
      value.iat > nowSeconds + 60 ||
      value.exp <= nowSeconds ||
      value.exp - value.iat !== PASSWORD_RECOVERY_PROOF_TTL_SECONDS
    ) {
      return null;
    }

    return { userId: value.sub, expiresAt: value.exp };
  } catch {
    return null;
  }
}
