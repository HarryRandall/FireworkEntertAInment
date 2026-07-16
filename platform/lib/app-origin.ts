import 'server-only';

/** Resolve the canonical origin used in trusted server-generated auth links. */
export function getTrustedAppOrigin(): string | null {
  const configured = process.env.APP_ORIGIN?.trim();
  const vercelProductionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const candidate =
    configured ||
    (vercelProductionHost ? `https://${vercelProductionHost}` : null) ||
    (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null);
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    const isLocalHttp =
      process.env.NODE_ENV !== 'production' &&
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1'].includes(url.hostname);
    if (url.username || url.password || (url.protocol !== 'https:' && !isLocalHttp)) return null;
    return url.origin;
  } catch {
    return null;
  }
}
