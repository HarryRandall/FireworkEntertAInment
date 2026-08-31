export const PROTECTED_PREFIXES = [
  '/exports',
  '/shows',
  '/recommendations',
  '/admin',
  '/settings',
  '/home',
  '/dashboard',
] as const;

export const AUTH_ONLY_PATHS = ['/login', '/signup'] as const;

export function matchesPathPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}
