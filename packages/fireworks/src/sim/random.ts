// Murmur3 finaliser: neighbouring particle indices must not produce correlated directions.
export function hash(a: number, b: number, c: number): number {
  let h =
    Math.imul(a | 0, 0x9e3779b1) ^
    Math.imul((b | 0) + 0x7f4a7c15, 0x85ebca77) ^
    Math.imul((c | 0) + 0x165667b1, 0xc2b2ae3d);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
