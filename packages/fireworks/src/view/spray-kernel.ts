/** GLSL spark kernel shared by the live view and transform-feedback parity tests. */
import { sparkTuning } from '../sim/spark-tuning';
import { rgb } from '../sim/colour';

// Decimal digits preserve the prototype tuning when emitting GLSL float literals.
const TUNING_DECIMAL_DIGITS = 8;
// GLSL constants retain the CPU's named prototype tuning, in the documented units.
const tuningSource = Object.entries(sparkTuning)
  .map(([name, value]) => `const float ${name} = ${value.toFixed(TUNING_DECIMAL_DIGITS)};`)
  .join('\n');
const ember = rgb('#ff7a33');
/** Analytic spark output in metres, linear RGB, renderer size and dimensionless opacity.
 * Requires highp GLSL ES 3, sampled birth rows and the Float32 direction lookup. */
export const sprayKernel = `
${tuningSource}
const vec3 EMBER = vec3(${ember.join(',')});
// Murmur3's fixed unsigned mixing words and normalisation, identical to the CPU hash.
const uint MURMUR_C1 = 0x9e3779b1u;
const uint MURMUR_C2 = 0x7f4a7c15u;
const uint MURMUR_C3 = 0x85ebca77u;
const uint MURMUR_C4 = 0x165667b1u;
const uint MURMUR_C5 = 0xc2b2ae3du;
const uint MURMUR_F1 = 0x85ebca6bu;
const uint MURMUR_F2 = 0xc2b2ae35u;
const float UINT32_RANGE = 4294967296.0;
// Murmur3 bit shifts, in bits; direction index uses the upper twelve of thirty-two bits.
const uint HASH_HIGH_SHIFT = 16u;
const uint HASH_MID_SHIFT = 13u;
const uint DIRECTION_INDEX_SHIFT = 20u;
uint hashWord(int a, int b, int c) {
  uint h = uint(a) * MURMUR_C1 ^ (uint(b) + MURMUR_C2) * MURMUR_C3
    ^ (uint(c) + MURMUR_C4) * MURMUR_C5;
  h = (h ^ (h >> HASH_HIGH_SHIFT)) * MURMUR_F1;
  h = (h ^ (h >> HASH_MID_SHIFT)) * MURMUR_F2;
  return h ^ (h >> HASH_HIGH_SHIFT);
}
float sparkHash(int a, int b, int c) { return float(hashWord(a,b,c)) / UINT32_RANGE; }
uniform highp sampler2D uBirths;
uniform highp sampler2D uDirections;
// Nine RGBA texels per birth, linearised across a texture's rows.
const int BIRTH_TEXELS = 9;
vec4 birthLane(int birth, int lane) {
  int index = birth * BIRTH_TEXELS + lane;
  int width = textureSize(uBirths, 0).x;
  return texelFetch(uBirths, ivec2(index % width, index / width), 0);
}
// Low/high 16-bit limbs are exact floats, including for negative and overflowed hash inputs.
const uint WORD_SHIFT = 16u;
int joinWord(float low, float high) { return int(uint(low) | (uint(high) << WORD_SHIFT)); }
struct SparkClock { int id; int seed; int flicker; float age; float life; };
struct Spark { vec3 position; vec3 colour; float size; float alpha; };
Spark invisibleSpark() { return Spark(vec3(0), vec3(0), 0.0, 0.0); }
vec3 sparkMotion(vec3 origin, vec3 velocity, float age, float drag, float gravity) {
  // Closed-form exponential drag integrates velocity and constant downward acceleration.
  float integral = (1.0 - exp(-drag * age)) / drag;
  return origin + velocity * integral - vec3(0, (gravity / drag) * (age - integral), 0);
}
vec3 forkDirection(int key, int seed) {
  float vertical = 2.0 * sparkHash(key, seed, int(FORK_VERTICAL_STREAM)) - 1.0;
  float azimuth = FORK_TAU_RAD * sparkHash(key, seed, int(FORK_AZIMUTH_STREAM));
  float horizontal = sqrt(1.0 - vertical * vertical);
  return vec3(horizontal * cos(azimuth), vertical, horizontal * sin(azimuth));
}
Spark forkSpark(int child, SparkClock clock, vec4 controls, vec4 colourSize,
  vec4 originAlpha, vec3 velocity, vec4 motion) {
  int id = clock.id;
  int seed = clock.seed;
  float forkTime = clock.life * (FORK_TIME_MIN + FORK_TIME_RANGE * sparkHash(id, seed, int(FORK_TIME_STREAM)));
  float age = clock.age - forkTime;
  if (age > FORK_LIFE_S || float(child) >= FORK_COUNT) return invisibleSpark();
  vec3 position = sparkMotion(originAlpha.xyz, velocity, forkTime, motion.y, motion.z);
  // Children fan from the parent's position once, then travel on a short decaying radius.
  position += forkDirection(id * int(FORK_KEY_STRIDE) + child, seed + int(FORK_SEED_OFFSET))
    * FORK_SPEED_M_S * age * (1.0 - age * FORK_DECAY_PER_S);
  return Spark(position, colourSize.xyz * FORK_COLOUR_WEIGHT + vec3(FORK_WHITE_WEIGHT),
    colourSize.w * FORK_SIZE_FACTOR, SPARK_ALPHA_MAX * (1.0 - age / FORK_LIFE_S) * originAlpha.w);
}
float glitterPhase(SparkClock clock, vec4 controls, float delay) {
  int id = clock.id;
  int seed = clock.seed;
  if (controls.w == 0.0 || sparkHash(id, seed, int(GLITTER_STREAM)) >= controls.w) return -1.0;
  float ignition = min(clock.life * GLITTER_LIFE_LIMIT,
    delay * (GLITTER_DELAY_MIN + GLITTER_DELAY_RANGE * sparkHash(id, seed, int(GLITTER_TIME_STREAM))));
  if (clock.age < ignition) return 0.0;
  if (clock.age < ignition + GLINT_LIFE_S) return 1.0 - (clock.age - ignition) / GLINT_LIFE_S;
  return -2.0;
}
vec3 coolingColour(vec3 colour, float progress, float glint) {
  if (glint > 0.0) return colour * GLINT_COLOUR_WEIGHT + vec3(GLINT_WHITE_WEIGHT);
  if (glint == 0.0) return colour * DORMANT_COLOUR_WEIGHT + EMBER * DORMANT_EMBER_WEIGHT;
  if (progress < WHITE_HOT_LIFE) return mix(vec3(1), colour, progress / WHITE_HOT_LIFE);
  return mix(colour, EMBER, min(EMBER_MIX_MAX, (progress - WHITE_HOT_LIFE) * EMBER_MIX_RATE));
}
Spark ordinarySpark(int sampleIndex, SparkClock clock, vec4 controls, vec4 colourSize,
  vec4 originAlpha, vec3 velocity, vec4 motion, vec4 extra) {
  float glint = glitterPhase(clock, controls, extra.x);
  if (glint < -1.0) return invisibleSpark();
  float age = clock.age - float(sampleIndex) * STREAK_STEP_S;
  if (sampleIndex > 0 && (glint >= 0.0 || float(sampleIndex) > controls.y || age < 0.0)) return invisibleSpark();
  int id = clock.id;
  int seed = clock.seed;
  float progress = clock.age / clock.life;
  float sizeRandom = sparkHash(id, seed, int(SIZE_STREAM));
  float flicker = 1.0 - motion.w * sparkHash(id, clock.flicker, seed);
  if (glint > 0.0) flicker = GLINT_ALPHA_MAX * glint;
  if (glint == 0.0) flicker = DORMANT_ALPHA;
  float size = colourSize.w * SPARK_SIZE_FACTOR * (SIZE_MIN + SIZE_RANGE * sizeRandom * sizeRandom * sizeRandom)
    * ((1.0 - progress) * SIZE_DECAY + SIZE_FLOOR) * (glint > 0.0 ? GLINT_SIZE_FACTOR : 1.0);
  float alpha = glint > 0.0 ? min(GLINT_ALPHA_MAX, flicker * originAlpha.w)
    : min(SPARK_ALPHA_MAX, SPARK_ALPHA_MAX * pow(1.0 - progress, ALPHA_FADE_POWER) * flicker * originAlpha.w)
      * (ALPHA_MIN + ALPHA_RANGE * sizeRandom * sizeRandom);
  if (sampleIndex > 0) {
    size *= STREAK_SIZE_FACTOR;
    alpha *= 1.0 - float(sampleIndex) / (controls.y + 1.0);
  }
  return Spark(sparkMotion(originAlpha.xyz, velocity, age, motion.y, motion.z),
    coolingColour(colourSize.xyz, progress, glint), size, alpha);
}
Spark evaluateSpark(int birth, int sampleIndex) {
  vec4 originAlpha = birthLane(birth, 0);
  vec4 inherited = birthLane(birth, 1);
  vec4 clockLane = birthLane(birth, 2);
  vec4 highWords = birthLane(birth, 8);
  SparkClock clock = SparkClock(joinWord(clockLane.x, highWords.x), joinWord(clockLane.y, highWords.y),
    joinWord(birthLane(birth, 6).w, highWords.z), clockLane.z, clockLane.w);
  vec4 colourSize = birthLane(birth, 3);
  vec4 motion = birthLane(birth, 4);
  vec4 controls = birthLane(birth, 5);
  vec4 extra = birthLane(birth, 6);
  vec4 direction = birthLane(birth, 7);
  if (clock.age < 0.0 || clock.age > clock.life || originAlpha.w <= BIRTH_ALPHA_CUTOFF) return invisibleSpark();
  int id = clock.id;
  int seed = clock.seed;
  // Integer shift avoids rounding a hash at a direction-table boundary in Float32.
  int directionIndex = int(hashWord(id, seed, int(DIRECTION_STREAM)) >> DIRECTION_INDEX_SHIFT);
  int width = textureSize(uDirections, 0).x;
  vec3 unitDirection = texelFetch(uDirections, ivec2(directionIndex % width, directionIndex / width), 0).xyz;
  if (extra.z != 0.0) unitDirection = unitDirection * extra.y + direction.xyz;
  float speedRandom = sparkHash(id, seed, int(SPEED_STREAM));
  float speed = motion.x * (controls.x != 0.0 ? GERB_SPEED_MIN + GERB_SPEED_RANGE * speedRandom
    : SPARK_SPEED_MIN + SPARK_SPEED_RANGE * speedRandom * speedRandom);
  vec3 velocity = unitDirection * speed + inherited.xyz;
  if (controls.z != 0.0 && sparkHash(id, seed, int(FORK_STREAM)) < controls.z) {
    float forkTime = clock.life * (FORK_TIME_MIN + FORK_TIME_RANGE * sparkHash(id, seed, int(FORK_TIME_STREAM)));
    if (clock.age >= forkTime) return forkSpark(sampleIndex, clock, controls, colourSize, originAlpha, velocity, motion);
  }
  return ordinarySpark(sampleIndex, clock, controls, colourSize, originAlpha, velocity, motion, extra);
}`;
