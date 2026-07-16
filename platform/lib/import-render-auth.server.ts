import 'server-only';

import {
  verifyImportRenderClaims,
  type ImportRenderAuthClaims,
} from '@/lib/import-render-auth-core';

export function isAuthorisedImportRenderRequest(
  claims: ImportRenderAuthClaims,
  signature: string,
): boolean {
  const secret = process.env.FIREWORK_IMPORT_SHARED_SECRET?.trim() ?? '';
  return verifyImportRenderClaims({ secret, claims, signature });
}
