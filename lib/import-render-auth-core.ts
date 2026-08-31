import { createHmac, timingSafeEqual } from 'node:crypto';

export const IMPORT_RENDER_AUTH_CONTEXT = 'showcrafter.import-render.v1';
export const IMPORT_RENDER_SIGNING_KEY_CONTEXT = 'showcrafter.import-render.signing-key.v1';
export const IMPORT_RENDER_AUTH_MAX_TTL_SECONDS = 300;

export type ImportRenderAuthClaims = {
  runId: string;
  expiresAt: number;
  nonce: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function authMessage({ runId, expiresAt, nonce }: ImportRenderAuthClaims): string {
  return `${IMPORT_RENDER_AUTH_CONTEXT}\n${runId}\n${expiresAt}\n${nonce}`;
}

/**
 * Keep the browser capability cryptographically separate from worker dispatch,
 * even when both operations are rooted in the same deployment secret.
 */
export function deriveImportRenderSigningKey(secret: string): Buffer {
  return createHmac('sha256', secret).update(IMPORT_RENDER_SIGNING_KEY_CONTEXT).digest();
}

export function buildImportRenderSignature(secret: string, claims: ImportRenderAuthClaims): string {
  return createHmac('sha256', deriveImportRenderSigningKey(secret))
    .update(authMessage(claims))
    .digest('base64url');
}

export function verifyImportRenderClaims({
  secret,
  claims,
  signature,
  nowSeconds = Math.floor(Date.now() / 1_000),
}: {
  secret: string;
  claims: ImportRenderAuthClaims;
  signature: string;
  nowSeconds?: number;
}): boolean {
  if (secret.length < 32) return false;
  if (!UUID_PATTERN.test(claims.runId)) return false;
  if (!Number.isInteger(claims.expiresAt)) return false;
  if (!NONCE_PATTERN.test(claims.nonce)) return false;
  if (!SIGNATURE_PATTERN.test(signature)) return false;
  if (
    claims.expiresAt < nowSeconds ||
    claims.expiresAt > nowSeconds + IMPORT_RENDER_AUTH_MAX_TTL_SECONDS
  ) {
    return false;
  }

  const expected = Buffer.from(buildImportRenderSignature(secret, claims), 'utf8');
  const received = Buffer.from(signature, 'utf8');
  return expected.length === received.length && timingSafeEqual(expected, received);
}
