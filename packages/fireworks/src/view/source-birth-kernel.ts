/** Source-clock GPU birth selection, origin sampling and finite-difference velocity inheritance. */
import { sprayKernel } from './spray-kernel';
import { sourceClockKernel } from './source-clock-kernel';
import { sourceMotionKernel } from './source-motion-kernel';
// Prototype scheduling/hash selectors, lifetime weights and source sampling in seconds.
const SLOT_ID_STRIDE = 7;
const CLUSTER_STREAM = 9;
const BIRTH_STREAM = 1;
const LIFE_STREAM = 2;
const LIFE_SCALE = 1.75;
const LIFE_BASE_WEIGHT = 0.3;
const LIFE_RANDOM_WEIGHT = 0.7;
const VELOCITY_STEP_S = 0.016;
const IGNITION_RISE_S = 0.07;
const END_FADE_START = 0.92;
const END_FADE_WINDOW = 0.08;
const birthTuning = {
  SLOT_ID_STRIDE,
  CLUSTER_STREAM,
  BIRTH_STREAM,
  LIFE_STREAM,
  LIFE_SCALE,
  LIFE_BASE_WEIGHT,
  LIFE_RANDOM_WEIGHT,
  VELOCITY_STEP_S,
  IGNITION_RISE_S,
  END_FADE_START,
  END_FADE_WINDOW,
};
// Decimal digits retain the rounded prototype tuning in GLSL literals.
const GLSL_DECIMAL_DIGITS = 8;
const constants = Object.entries(birthTuning)
  .map(([name, value]) => `const float ${name} = ${value.toFixed(GLSL_DECIMAL_DIGITS)};`)
  .join('\n');
// Binary search needs at most 24 comparisons within the Float32 exact candidate range (2^24).
const SOURCE_SEARCH_STEPS = 24;
/** GLSL ES 3 kernel derives each candidate's stable identity and initial conditions from source and time. */
export const sourceBirthKernel = `${sprayKernel}
${sourceMotionKernel}
${sourceClockKernel}
${constants}
struct Birth { int id; int source; int sampleIndex; float time; float local; float age; float life; float alpha; vec3 origin; vec3 inherited; bool visible; };
int candidateSource(int candidateIndex) {
  int low = 0;
  int high = uSourceCount;
  for (int step = 0; step < ${String(SOURCE_SEARCH_STEPS)}; step++) {
    if (low >= high) break;
    int middle = low + (high - low) / 2;
    if (float(candidateIndex) < sourceLane(middle, L_bounds).w) high = middle;
    else low = middle + 1;
  }
  return low;
}
float sourceAlpha(int source, float time) {
  vec4 fade = sourceLane(source, L_fade);
  if (fade.x == 0.0) return fade.w;
  float progress = time / fade.z;
  float alpha = min(1.0, time / IGNITION_RISE_S);
  if (progress > fade.y) alpha *= max(0.0, 1.0 - (progress - fade.y) / (1.0 - fade.y));
  if (progress > END_FADE_START) alpha *= max(0.0, (1.0 - progress) / END_FADE_WINDOW);
  return alpha;
}
Birth selectBirth(int source, int candidateIndex) {
  vec4 bounds = sourceLane(source, L_bounds);
  vec4 schedule = sourceLane(source, L_schedule);
  vec4 identity = sourceLane(source, L_identity);
  int seed = joinWord(identity.x, identity.y);
  int samples = int(identity.z);
  int clusterCandidates = int(identity.w);
  int relative = candidateIndex - int(sourceLane(source, L_trajectory).y);
  int sparkIndex = relative / samples;
  int clusterIndex = sparkIndex % clusterCandidates;
  vec4 clock = sourceLane(source, L_clock);
  float now = clock.x + clock.y;
  int lastSlot = int(clock.z);
  int firstSlot = max(int(floor(bounds.x / schedule.x)), int(floor((now - schedule.y * LIFE_SCALE) / schedule.x)));
  int slot = lastSlot - sparkIndex / clusterCandidates;
  int id = slot * int(SLOT_ID_STRIDE) + clusterIndex;
  float local = (float(slot - lastSlot) + sparkHash(id, seed, int(BIRTH_STREAM))) * schedule.x;
  float time = clock.x + local;
  float random = sparkHash(id, seed, int(LIFE_STREAM));
  float shortLife = LIFE_RANDOM_WEIGHT * random + LIFE_BASE_WEIGHT;
  // Same repeated squaring as the CPU kernel, retaining the sixteenth-power long-life tail.
  float tail = random * random; tail *= tail; tail *= tail; tail *= tail;
  float life = schedule.y * LIFE_SCALE * (LIFE_RANDOM_WEIGHT * shortLife * shortLife + LIFE_BASE_WEIGHT * tail);
  int cluster = 1 + int(floor(sparkHash(slot, seed, int(CLUSTER_STREAM)) * schedule.w));
  float age = clock.y - local;
  float alpha = sourceAlpha(source, time);
  bool visible = slot >= firstSlot && clusterIndex < cluster && time >= bounds.x && time <= bounds.y && time <= now && age <= life && alpha > BIRTH_ALPHA_CUTOFF;
  return Birth(id, source, relative % samples, time, local, age, life, alpha, vec3(0), vec3(0), visible);
}
Birth sampleBirth(int candidateIndex) {
  int source = candidateSource(candidateIndex);
  Birth birth = selectBirth(source, candidateIndex);
  if (!birth.visible) return birth;
  birth.origin = sampleSource(source, birth.time, birth.local, 0.0) + sourceLane(source, L_origin).xyz;
  float inherit = sourceLane(source, L_schedule).z;
  if (inherit != 0.0) {
    // Use a backward difference in the source's final 16 ms, exactly as the reference does.
    bool back = birth.time + VELOCITY_STEP_S > sourceLane(source, L_bounds).y;
    vec3 before = sampleSource(source, birth.time, birth.local, back ? -VELOCITY_STEP_S : 0.0);
    vec3 after = sampleSource(source, birth.time, birth.local, back ? 0.0 : VELOCITY_STEP_S);
    birth.inherited = (after - before) / VELOCITY_STEP_S * inherit;
  }
  return birth;
}
Spark evaluateSourceSpark(int candidateIndex) {
  Birth birth = sampleBirth(candidateIndex);
  if (!birth.visible) return invisibleSpark();
  int source = birth.source;
  vec4 identity = sourceLane(source, L_identity);
  SparkClock clock = SparkClock(birth.id, joinWord(identity.x, identity.y),
    sourceFlickerClock(source, birth.id), birth.age, birth.life);
  return evaluateSampledSpark(birth.sampleIndex, vec4(birth.origin, birth.alpha), birth.inherited, clock,
    sourceLane(source, L_colour), sourceLane(source, L_motion), sourceLane(source, L_controls),
    sourceLane(source, L_extra), sourceLane(source, L_direction));
}
`;
