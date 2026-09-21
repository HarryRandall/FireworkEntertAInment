import type { Json } from '@/lib/database.types';
import type { PermissionKey, ProfileStatus, RoleKey } from '@/lib/access/types';

const ROLE_KEYS: readonly RoleKey[] = ['admin', 'supplier', 'user'];

function isRoleKey(value: string): value is RoleKey {
  return ROLE_KEYS.includes(value as RoleKey);
}

/** Coerce a free-form string into a known role, defaulting to the least privileged role. */
export function asRoleKey(value: string): RoleKey {
  return isRoleKey(value) ? value : 'user';
}

/** Preserve database permission keys while retaining the known application union. */
export function asPermissionKey(value: string): PermissionKey {
  return value as PermissionKey;
}

/** Map a database profile status to the narrowed application value. */
export function asProfileStatus(value: string): ProfileStatus {
  return value === 'suspended' ? 'suspended' : 'active';
}

/** Type guard for plain JSON objects. */
export function isRecord(value: Json | undefined): value is Record<string, Json | undefined> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Return items in first-seen order without duplicates. */
export function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}
