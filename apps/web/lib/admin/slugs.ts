/** Slug helpers shared by the admin catalogue actions. */
import type { FireworkStyleDefaultKind } from '@showcrafter/fireworks/style-defaults';

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Unique slug for a new style default, falling back to its kind. */
export function styleDefaultSlug(name: string, kind: FireworkStyleDefaultKind): string {
  const base = slugify(name) || `${kind}-style`;
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}
