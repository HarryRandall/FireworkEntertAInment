import { timingSafeEqual } from 'node:crypto';

export function authoriseAnalyserCallback(
  authorization: string | null,
  secret: string | undefined,
): boolean {
  if (!secret || !authorization?.startsWith('Bearer ')) return false;
  const expected = Buffer.from(secret);
  const supplied = Buffer.from(authorization.slice(7));
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
