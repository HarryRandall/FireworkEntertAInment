export function importRenderContentSecurityPolicy(nonce: string): string {
  const developmentScript = process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : '';
  const developmentConnect = process.env.NODE_ENV === 'development' ? ' ws: wss:' : '';
  return [
    "default-src 'none'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${developmentScript}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "font-src 'self'",
    `connect-src 'self'${developmentConnect}`,
    "worker-src 'self' blob:",
    "manifest-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}
