import { timingSafeEqual } from 'node:crypto';

export function authoriseAnalyserCallback(
  authorization: string | null,
  secret: string | undefined,
): boolean {
  // Match the whitespace normalisation applied when the secret is sent as an HTTP header.
  const normalisedSecret = secret?.trim();
  if (!normalisedSecret || !authorization?.startsWith('Bearer ')) return false;
  const expected = Buffer.from(normalisedSecret);
  const supplied = Buffer.from(authorization.slice(7));
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
