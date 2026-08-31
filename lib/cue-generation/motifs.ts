/**
 * Pick a small stable product phrase for a musical section family. Repeated
 * choruses therefore reuse a recognisable visual vocabulary while the caller
 * can still rotate within the phrase for variation.
 */
export function recurringMotifIds(productIds: string[], sectionFamily: string, size = 3): string[] {
  const unique = Array.from(new Set(productIds));
  if (unique.length <= size) return unique;
  const start = stableHash(sectionFamily) % unique.length;
  return Array.from(
    { length: Math.min(Math.max(1, size), unique.length) },
    (_, offset) => unique[(start + offset) % unique.length],
  );
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
