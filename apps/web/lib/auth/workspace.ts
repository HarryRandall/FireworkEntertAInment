/** Public workspace presentation derived from verified server identity facts. */
import { permittedAreas, type AccessIdentity, type Area } from './areas';

/** Serialisable shell input without Auth tokens or private membership records. */
export interface WorkspaceIdentity {
  permittedAreas: readonly Area[];
  displayName: string | null;
  email: string | null;
}

/** Selects public profile fields and computes navigation permissions from verified access facts. */
export function workspaceIdentity(
  access: AccessIdentity,
  displayName: string | null,
  email: string | undefined,
): WorkspaceIdentity {
  return { permittedAreas: permittedAreas(access), displayName, email: email ?? null };
}
