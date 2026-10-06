/** Binary64 clock arithmetic retains the CPU flicker hash tick at exact integer boundaries. */
import { sparkTuning } from '../sim/spark-tuning';
// IEEE 754 binary64 stores a 52-bit fraction, an implicit leading bit and an 11-bit biased exponent.
const FRACTION_HIGH_MASK = 0xfffff;
const IMPLICIT_HIGH_BIT = 0x100000;
const NORMAL_HIGH_LIMIT = 0x1fffff;
const EXPONENT_BIAS = 1023;
const FRACTION_BITS = 52;
const EXPONENT_HIGH_SHIFT = 20;
const WORD_BITS = 32;
const LIMB_BITS = 16;
const LIMB_MASK = 0xffff;
// IEEE 754 sign, exponent and absolute-value masks in the high 32-bit word.
const SIGN_MASK = 0x80000000;
const EXPONENT_MASK = 0x7ff;
const MAGNITUDE_MASK = 0x7fffffff;
// Three guard/round/sticky bits preserve nearest-even binary64 addition before normalisation.
const ADDITION_GUARD_BITS = 3;
// Two unsigned words contain 64 bits; shifts beyond this retain only the sticky bit.
const CLOCK_WORD_PAIR_BITS = 64;
// Binary64 and word storage sizes in bytes, from IEEE 754.
const FLOAT64_BYTES = 8;
const WORD_BYTES = 4;
const encoding = new DataView(new ArrayBuffer(FLOAT64_BYTES));
encoding.setFloat64(0, sparkTuning.FLICKER_PHASE_S, true);
const phaseLow = encoding.getUint32(0, true);
const phaseHigh = encoding.getUint32(WORD_BYTES, true);
const phaseMantissaHigh = (phaseHigh & FRACTION_HIGH_MASK) | IMPLICIT_HIGH_BIT;
const phaseExponent = (phaseHigh >>> EXPONENT_HIGH_SHIFT) - EXPONENT_BIAS - FRACTION_BITS;
/** GLSL unsigned-word emulation of the CPU's two binary64 operations before floor.
 * Inputs are normal finite source seconds and a signed 32-bit spark ID; no trajectories are sampled. */
export const sourceClockKernel = `
uniform highp sampler2D uSourceClocks;
const uint LIMB_MASK = ${String(LIMB_MASK)}u;
const uint LIMB_BITS = ${String(LIMB_BITS)}u;
const uint WORD_BITS = ${String(WORD_BITS)}u;
const uint NORMAL_HIGH_LIMIT = ${String(NORMAL_HIGH_LIMIT)}u;
const uint IMPLICIT_HIGH_BIT = ${String(IMPLICIT_HIGH_BIT)}u;
const uint FRACTION_HIGH_MASK = ${String(FRACTION_HIGH_MASK)}u;
const uint EXPONENT_HIGH_SHIFT = ${String(EXPONENT_HIGH_SHIFT)}u;
const int EXPONENT_BIAS = ${String(EXPONENT_BIAS)};
const int FRACTION_BITS = ${String(FRACTION_BITS)};
const int ADDITION_GUARD_BITS = ${String(ADDITION_GUARD_BITS)};
struct ClockNumber { uvec2 mantissa; int exponent; bool negative; };
uvec3 shiftClockRight(uvec3 words) {
  return uvec3((words.x >> 1u) | (words.y << (WORD_BITS - 1u)),
    (words.y >> 1u) | (words.z << (WORD_BITS - 1u)), words.z >> 1u);
}
ClockNumber normaliseClock(uvec3 words, int exponent, bool negative) {
  bool sticky = false;
  bool roundBit = false;
  while (words.z != 0u || words.y > NORMAL_HIGH_LIMIT) {
    sticky = sticky || roundBit;
    roundBit = (words.x & 1u) != 0u;
    words = shiftClockRight(words);
    exponent++;
  }
  // Round once, ties to even, as the CPU does after each binary64 operation.
  if (roundBit && (sticky || (words.x & 1u) != 0u)) {
    words.x++;
    if (words.x == 0u) words.y++;
    if (words.y > NORMAL_HIGH_LIMIT) { words = shiftClockRight(words); exponent++; }
  }
  if (words.x == 0u && words.y == 0u) return ClockNumber(uvec2(0), 0, false);
  while (words.y < IMPLICIT_HIGH_BIT) {
    words.y = (words.y << 1u) | (words.x >> (WORD_BITS - 1u));
    words.x <<= 1u;
    exponent--;
  }
  return ClockNumber(words.xy, exponent, negative);
}
uvec2 multiplyClockWord(uint left, uint right) {
  // Base-65536 school multiplication keeps each intermediate within unsigned 32 bits.
  uint lowProduct = (left & LIMB_MASK) * (right & LIMB_MASK);
  uint middle = (left >> LIMB_BITS) * (right & LIMB_MASK) + (lowProduct >> LIMB_BITS);
  uint middleLow = middle & LIMB_MASK;
  uint high = middle >> LIMB_BITS;
  middleLow += (left & LIMB_MASK) * (right >> LIMB_BITS);
  high += (middleLow >> LIMB_BITS) + (left >> LIMB_BITS) * (right >> LIMB_BITS);
  return uvec2((middleLow << LIMB_BITS) | (lowProduct & LIMB_MASK), high);
}
ClockNumber multiplyClock(ClockNumber value, uint factor) {
  uvec2 lowProduct = multiplyClockWord(value.mantissa.x, factor);
  uvec2 highProduct = multiplyClockWord(value.mantissa.y, factor);
  uint middle = lowProduct.y + highProduct.x;
  uint carry = middle < lowProduct.y ? 1u : 0u;
  return normaliseClock(uvec3(lowProduct.x, middle, highProduct.y + carry), value.exponent, value.negative);
}
uvec2 alignedClock(ClockNumber value, int exponent) {
  uvec2 words = uvec2(value.mantissa.x << uint(ADDITION_GUARD_BITS),
    (value.mantissa.y << uint(ADDITION_GUARD_BITS)) | (value.mantissa.x >> (WORD_BITS - uint(ADDITION_GUARD_BITS))));
  bool sticky = false;
  int difference = min(exponent - value.exponent, ${String(CLOCK_WORD_PAIR_BITS)});
  for (int bit = 0; bit < difference; bit++) {
    sticky = sticky || (words.x & 1u) != 0u;
    words = shiftClockRight(uvec3(words, 0)).xy;
  }
  if (sticky) words.x |= 1u;
  return words;
}
ClockNumber addClock(ClockNumber left, ClockNumber right) {
  if (left.mantissa == uvec2(0)) return right;
  if (right.mantissa == uvec2(0)) return left;
  int exponent = max(left.exponent, right.exponent);
  uvec2 a = alignedClock(left, exponent);
  uvec2 b = alignedClock(right, exponent);
  uvec2 sum;
  bool negative = left.negative;
  if (left.negative == right.negative) {
    sum.x = a.x + b.x;
    sum.y = a.y + b.y + (sum.x < a.x ? 1u : 0u);
  } else {
    bool reversed = a.y < b.y || (a.y == b.y && a.x < b.x);
    if (reversed) { uvec2 swap = a; a = b; b = swap; negative = right.negative; }
    sum.x = a.x - b.x;
    sum.y = a.y - b.y - (a.x < b.x ? 1u : 0u);
  }
  return normaliseClock(uvec3(sum, 0), exponent - ADDITION_GUARD_BITS, negative);
}
ClockNumber sourceClock(int source) {
  int width = textureSize(uSourceClocks, 0).x;
  vec4 limbs = texelFetch(uSourceClocks, ivec2(source % width, source / width), 0);
  uint low = uint(limbs.x) | (uint(limbs.y) << LIMB_BITS);
  uint high = uint(limbs.z) | (uint(limbs.w) << LIMB_BITS);
  if (low == 0u && (high & ${String(MAGNITUDE_MASK)}u) == 0u) return ClockNumber(uvec2(0), 0, false);
  return ClockNumber(uvec2(low, (high & FRACTION_HIGH_MASK) | IMPLICIT_HIGH_BIT),
    int((high >> EXPONENT_HIGH_SHIFT) & ${String(EXPONENT_MASK)}u) - EXPONENT_BIAS - FRACTION_BITS, (high & ${String(SIGN_MASK)}u) != 0u);
}
int floorClock(ClockNumber value) {
  bool fractional = false;
  uvec3 words = uvec3(value.mantissa, 0);
  for (int bit = value.exponent; bit < 0; bit++) {
    fractional = fractional || (words.x & 1u) != 0u;
    words = shiftClockRight(words);
  }
  uint integer = words.x;
  if (value.exponent > 0) integer <<= uint(value.exponent);
  if (!value.negative) return int(integer);
  return -int(integer) - (fractional ? 1 : 0);
}
int sourceFlickerClock(int source, int id) {
  ClockNumber phase = ClockNumber(uvec2(${String(phaseLow)}u, ${String(phaseMantissaHigh)}u), ${String(phaseExponent)}, id < 0);
  uint magnitude = id < 0 ? 0u - uint(id) : uint(id);
  ClockNumber time = addClock(sourceClock(source), multiplyClock(phase, magnitude));
  return floorClock(multiplyClock(time, uint(FLICKER_HZ)));
}
`;
