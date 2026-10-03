/** Deterministic hash sampling for reproducible firework geometry and colour choices. */

// MurmurHash3 finaliser: upper-word xor shift, bits.
const FINAL_HIGH_SHIFT_BITS = 16;
// MurmurHash3 finaliser: middle xor shift, bits.
const FINAL_MID_SHIFT_BITS = 13;
// Murmur3 finaliser constants are fixed 32-bit mixing values, from the MurmurHash3 algorithm.
const MURMUR_C1 = 0x9e3779b1;
const MURMUR_C2 = 0x7f4a7c15;
const MURMUR_C3 = 0x85ebca77;
const MURMUR_C4 = 0x165667b1;
const MURMUR_C5 = 0xc2b2ae3d;
const MURMUR_F1 = 0x85ebca6b;
const MURMUR_F2 = 0xc2b2ae35;
const UINT32_RANGE = 4294967296;

/** Mixes three dimensionless integers into a repeatable sample in [0, 1). */
export function hash(a: number, b: number, c: number): number {
  let h =
    Math.imul(a | 0, MURMUR_C1) ^
    Math.imul((b | 0) + MURMUR_C2, MURMUR_C3) ^
    Math.imul((c | 0) + MURMUR_C4, MURMUR_C5);
  h = Math.imul(h ^ (h >>> FINAL_HIGH_SHIFT_BITS), MURMUR_F1);
  h = Math.imul(h ^ (h >>> FINAL_MID_SHIFT_BITS), MURMUR_F2);
  h ^= h >>> FINAL_HIGH_SHIFT_BITS;
  return (h >>> 0) / UINT32_RANGE;
}
