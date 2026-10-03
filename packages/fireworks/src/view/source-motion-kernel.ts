/** Analytic GPU source trajectories, matching the unchanged CPU callbacks and their ordered modifiers. */
import { sourceTrigonometryKernel } from './source-trigonometry-kernel';
import { sourceLane, SourceKind, SourceModifier, SOURCE_TEXELS } from './source-layout';
// Prototype motion tuning: metres, inverse seconds or radians/second as named; dimensionless ratios.
const CLEARANCE_M = 6;
const CLIMB_SWAY_RAD_S = 3;
const CLIMB_SWAY_M = 0.25;
const JITTER_X_RAD_S = 251;
const JITTER_Z_RAD_S = 197;
const WOBBLE_X_RAD_S = 19;
const WOBBLE_Z_RAD_S = 15;
const WOBBLE_Z_SCALE = 0.6;
const WHEEL_RAMP_S = 1;
const SPINNER_X_RAD_S = 0.9;
const SPINNER_X_HARMONIC_RAD_S = 2.3;
const SPINNER_X_HARMONIC_SCALE = 0.3;
const SPINNER_ORBIT_M = 0.6;
const SPINNER_BOUNCE_RAD_S = 5;
const SPINNER_BOUNCE_M = 0.35;
const SPINNER_Z_RAD_S = 0.7;
const SPINNER_Z_SCALE = 0.8;
const FISH_WAVE_M = 1.4;
const FISH_RISE_PER_S = 3;
const FISH_VERTICAL_RATIO = 0.7;
const FISH_VERTICAL_M = 0.6;
const BEE_RATE_RAD_S = 7;
const BEE_RISE_PER_S = 2;
const BEE_REACH_M = 2.2;
const BEE_Y_PHASE_RAD = 1;
const BEE_Z_PHASE_RAD = 2;
const BEE_X_RATE = 1.3;
const BEE_X_HARMONIC = 2.9;
const BEE_Y_RATE = 1.7;
const BEE_Y_HARMONIC = 3.3;
const BEE_Z_RATE = 1.1;
const BEE_Z_HARMONIC = 2.3;
const FLUTTER_RISE_PER_S = 0.8;
const FLUTTER_RADIUS_FRACTION = 0.12;
const FLUTTER_X_RAD_S = 4.4;
const FLUTTER_Z_RAD_S = 3.7;
/** Prototype source motion constants shared by Float64 phase packing and GLSL evaluation. */
export const motionTuning = {
  CLEARANCE_M,
  CLIMB_SWAY_RAD_S,
  CLIMB_SWAY_M,
  JITTER_X_RAD_S,
  JITTER_Z_RAD_S,
  WOBBLE_X_RAD_S,
  WOBBLE_Z_RAD_S,
  WOBBLE_Z_SCALE,
  WHEEL_RAMP_S,
  SPINNER_X_RAD_S,
  SPINNER_X_HARMONIC_RAD_S,
  SPINNER_X_HARMONIC_SCALE,
  SPINNER_ORBIT_M,
  SPINNER_BOUNCE_RAD_S,
  SPINNER_BOUNCE_M,
  SPINNER_Z_RAD_S,
  SPINNER_Z_SCALE,
  FISH_WAVE_M,
  FISH_RISE_PER_S,
  FISH_VERTICAL_RATIO,
  FISH_VERTICAL_M,
  BEE_RATE_RAD_S,
  BEE_RISE_PER_S,
  BEE_REACH_M,
  BEE_Y_PHASE_RAD,
  BEE_Z_PHASE_RAD,
  BEE_X_RATE,
  BEE_X_HARMONIC,
  BEE_Y_RATE,
  BEE_Y_HARMONIC,
  BEE_Z_RATE,
  BEE_Z_HARMONIC,
  FLUTTER_RISE_PER_S,
  FLUTTER_RADIUS_FRACTION,
  FLUTTER_X_RAD_S,
  FLUTTER_Z_RAD_S,
};
// Decimal digits retain the rounded prototype tuning in GLSL literals.
const GLSL_DECIMAL_DIGITS = 8;
const constants = Object.entries(motionTuning)
  .map(([name, value]) => `const float ${name} = ${value.toFixed(GLSL_DECIMAL_DIGITS)};`)
  .join('\n');
const lanes = Object.entries(sourceLane)
  .filter(([, lane]) => typeof lane === 'number')
  .map(([name, lane]) => `const int L_${name} = ${String(lane)};`)
  .join('\n');
/** GLSL ES 3 source sampling in metres at source-clock seconds; texture records follow source-layout. */
export const sourceMotionKernel = `
${constants}
${lanes}
${sourceTrigonometryKernel}
uniform highp sampler2D uSources;
uniform float uSourceTime;
uniform int uSourceCount;
vec4 sourceLane(int source, int lane) {
  int index = source * ${String(SOURCE_TEXELS)} + lane;
  int width = textureSize(uSources, 0).x;
  return texelFetch(uSources, ivec2(index % width, index / width), 0);
}
float phaseAt(int source, int index, float rate, float local) {
  vec4 phases = sourceLane(source, L_phases + index / 4);
  return phases[index % 4] + local * rate;
}
float modifierPhaseAt(int source, int index, int harmonic, float rate, float local) {
  vec4 phases = sourceLane(source, L_modifierPhases + index * 2 + harmonic / 4);
  return phases[harmonic % 4] + local * rate;
}
// Angle addition shares the rounded birth phase across both velocity samples.
// The 16 ms advance never passes through a large phase or absolute source clock.
float shiftedSin(float angle, float advance) { return sourceSin(angle) * sourceCos(advance) + sourceCos(angle) * sourceSin(advance); }
float shiftedCos(float angle, float advance) { return sourceCos(angle) * sourceCos(advance) - sourceSin(angle) * sourceSin(advance); }
float wheelAdvance(float anchor, float local) {
  float time = anchor + local;
  if (anchor < WHEEL_RAMP_S && time < WHEEL_RAMP_S) return local * (anchor + local * 0.5);
  if (anchor < WHEEL_RAMP_S) return local - 0.5 * (anchor - WHEEL_RAMP_S) * (anchor - WHEEL_RAMP_S);
  if (time < WHEEL_RAMP_S) return local + 0.5 * (time - WHEEL_RAMP_S) * (time - WHEEL_RAMP_S);
  return local;
}
float clearance(float height) { return clamp(height / CLEARANCE_M, 0.0, 1.0); }
vec3 launchSource(int source, float time, float local, float step) {
  time += step;
  vec4 origin = sourceLane(source, L_origin);
  vec4 travel = sourceLane(source, L_travel);
  vec4 shape = sourceLane(source, L_shape);
  float progress = clamp(time / travel.y, 0.0, 1.0);
  float height = origin.y + (travel.x - origin.y) * (1.0 - (1.0 - progress) * (1.0 - progress));
  float clear = clearance(height - origin.y);
  vec3 outPosition = vec3(travel.z * height + shiftedSin(phaseAt(source, 0, CLIMB_SWAY_RAD_S, local), (CLIMB_SWAY_RAD_S) * step) * CLIMB_SWAY_M * clear, height - origin.y, 0.0);
  outPosition.x += shiftedSin(phaseAt(source, 1, JITTER_X_RAD_S, local), (JITTER_X_RAD_S) * step) * shape.x * clear;
  outPosition.z += shiftedCos(phaseAt(source, 2, JITTER_Z_RAD_S, local), (JITTER_Z_RAD_S) * step) * shape.x * clear;
  outPosition.x += shiftedSin(phaseAt(source, 3, WOBBLE_X_RAD_S, local), (WOBBLE_X_RAD_S) * step) * shape.y * clear;
  outPosition.z += shiftedCos(phaseAt(source, 4, WOBBLE_Z_RAD_S, local), (WOBBLE_Z_RAD_S) * step) * shape.y * WOBBLE_Z_SCALE * clear;
  float decay = sourceLane(source, L_embellishment).x != 0.0 ? 1.0 : 1.0 - min(1.0, time / travel.y);
  float radius = shape.z * decay * clear;
  outPosition.x += shiftedCos(phaseAt(source, 5, shape.w, local), (shape.w) * step) * radius;
  outPosition.z += shiftedSin(phaseAt(source, 5, shape.w, local), (shape.w) * step) * radius;
  return outPosition;
}
vec3 rotatedStarDirection(int source, float local, float step, vec3 direction) {
  int count = int(sourceLane(source, L_starPhase).y);
  for (int index = 0; index < count; index++) {
    vec4 modifier = sourceLane(source, L_modifiers + index);
    if (int(modifier.x) != ${String(SourceModifier.Twist)}) continue;
    float angle = modifierPhaseAt(source, index, 0, modifier.y, local);
    float cosine = shiftedCos(angle, modifier.y * step);
    float sine = shiftedSin(angle, modifier.y * step);
    if (modifier.z != 0.0) direction.xy = vec2(direction.x * cosine - direction.y * sine, direction.x * sine + direction.y * cosine);
    else direction.xz = vec2(direction.x * cosine + direction.z * sine, -direction.x * sine + direction.z * cosine);
  }
  return direction;
}
vec3 starWiggle(int source, float time, float local, float step, vec3 direction) {
  vec4 starPhase = sourceLane(source, L_starPhase);
  vec3 wiggle = vec3(0);
  for (int index = 0; index < int(starPhase.y); index++) {
    vec4 modifier = sourceLane(source, L_modifiers + index);
    int kind = int(modifier.x);
    if (kind == ${String(SourceModifier.Fish)}) {
      float wave = shiftedSin(modifierPhaseAt(source, index, 0, modifier.y, local), (modifier.y) * step) * FISH_WAVE_M * modifier.z * min(1.0, time * FISH_RISE_PER_S);
      float directionLength = length(direction.xy);
      if (directionLength == 0.0) directionLength = 1.0;
      wiggle.xy += vec2(-direction.y, direction.x) / directionLength * wave;
      wiggle.y += shiftedCos(modifierPhaseAt(source, index, 1, modifier.y * FISH_VERTICAL_RATIO, local), (modifier.y * FISH_VERTICAL_RATIO) * step) * FISH_VERTICAL_M;
    } else if (kind == ${String(SourceModifier.Bees)}) {
      float amplitude = min(1.0, time * BEE_RISE_PER_S) * BEE_REACH_M;
      wiggle += vec3(shiftedSin(modifierPhaseAt(source, index, 0, BEE_RATE_RAD_S * BEE_X_RATE, local), (BEE_RATE_RAD_S * BEE_X_RATE) * step) + shiftedSin(modifierPhaseAt(source, index, 1, BEE_RATE_RAD_S * BEE_X_HARMONIC, local), (BEE_RATE_RAD_S * BEE_X_HARMONIC) * step) * 0.5,
        shiftedSin(modifierPhaseAt(source, index, 2, BEE_RATE_RAD_S * BEE_Y_RATE, local), (BEE_RATE_RAD_S * BEE_Y_RATE) * step) + shiftedSin(modifierPhaseAt(source, index, 3, BEE_RATE_RAD_S * BEE_Y_HARMONIC, local), (BEE_RATE_RAD_S * BEE_Y_HARMONIC) * step) * 0.5,
        shiftedSin(modifierPhaseAt(source, index, 4, BEE_RATE_RAD_S * BEE_Z_RATE, local), (BEE_RATE_RAD_S * BEE_Z_RATE) * step) + shiftedSin(modifierPhaseAt(source, index, 5, BEE_RATE_RAD_S * BEE_Z_HARMONIC, local), (BEE_RATE_RAD_S * BEE_Z_HARMONIC) * step) * 0.5) * amplitude;
    } else if (kind == ${String(SourceModifier.Flutter)}) {
      float amplitude = min(1.0, time * FLUTTER_RISE_PER_S) * FLUTTER_RADIUS_FRACTION * sourceLane(source, L_travel).w * modifier.y;
      wiggle.xz += vec2(shiftedSin(modifierPhaseAt(source, index, 0, FLUTTER_X_RAD_S, local), (FLUTTER_X_RAD_S) * step), shiftedCos(modifierPhaseAt(source, index, 1, FLUTTER_Z_RAD_S, local), (FLUTTER_Z_RAD_S) * step)) * amplitude;
    }
  }
  return wiggle;
}
vec3 dragSource(int source, float time, float local, float step, bool child) {
  time += step;
  vec4 travel = sourceLane(source, L_travel);
  vec3 direction = sourceLane(source, L_starDirection).xyz;
  float age = child ? sourceLane(source, L_clock).w + local + step : time;
  vec3 rotated = child ? direction : rotatedStarDirection(source, local, step, direction);
  float fraction = 1.0 - exp(-travel.y * age);
  vec3 position = rotated * travel.x * fraction;
  position.y -= (travel.z / travel.y) * (age - fraction / travel.y);
  return child ? position : position + starWiggle(source, age, local, step, direction);
}
vec3 rotatingSource(int source, float time, float local, float step, bool wheel) {
  vec4 travel = sourceLane(source, L_travel);
  float radius = travel.x;
  float speed = travel.y;
  if (wheel) {
    float anchor = sourceLane(source, L_clock).x;
    float angle = phaseAt(source, 0, speed, wheelAdvance(anchor, local));
    float advance = speed * wheelAdvance(time, step);
    return vec3(shiftedCos(angle, advance) * radius, shiftedSin(angle, advance) * radius, 0);
  }
  float angle = phaseAt(source, 0, speed, local);
  return vec3(shiftedSin(phaseAt(source, 1, SPINNER_X_RAD_S, local), (SPINNER_X_RAD_S) * step) * radius + shiftedSin(phaseAt(source, 2, SPINNER_X_HARMONIC_RAD_S, local), (SPINNER_X_HARMONIC_RAD_S) * step) * radius * SPINNER_X_HARMONIC_SCALE + shiftedCos(angle, speed * step) * SPINNER_ORBIT_M,
    abs(shiftedSin(phaseAt(source, 3, SPINNER_BOUNCE_RAD_S, local), (SPINNER_BOUNCE_RAD_S) * step)) * SPINNER_BOUNCE_M,
    shiftedCos(phaseAt(source, 4, SPINNER_Z_RAD_S, local), (SPINNER_Z_RAD_S) * step) * radius * SPINNER_Z_SCALE + shiftedSin(angle, speed * step) * SPINNER_ORBIT_M);
}
vec3 climbingSource(int source, float time, float local, float step, bool comet) {
  time += step;
  vec3 origin = sourceLane(source, L_origin).xyz;
  vec4 travel = sourceLane(source, L_travel);
  vec4 shape = sourceLane(source, L_shape);
  float progress = min(1.0, time / travel.y);
  if (comet) progress = max(0.0, progress);
  float distance = (comet ? travel.x : travel.x - origin.y) * (1.0 - (1.0 - progress) * (1.0 - progress));
  float angle = phaseAt(source, 0, travel.z, local);
  float radius = travel.w * clearance(distance);
  if (comet) return vec3(sourceSin(shape.x) * distance + shiftedCos(angle, travel.z * step) * radius, sourceCos(shape.x) * sourceCos(shape.y) * distance, sourceSin(shape.y) * distance + shiftedSin(angle, travel.z * step) * radius);
  return vec3(shape.x * progress + shiftedCos(angle, travel.z * step) * radius, distance, shiftedSin(angle, travel.z * step) * radius);
}
vec3 sampleSource(int source, float time, float local, float step) {
  int kind = int(sourceLane(source, L_trajectory).x);
  if (kind == ${String(SourceKind.Launch)}) return launchSource(source, time, local, step);
  if (kind == ${String(SourceKind.Star)}) return dragSource(source, time, local, step, false);
  if (kind == ${String(SourceKind.Child)}) return dragSource(source, time, local, step, true);
  if (kind == ${String(SourceKind.Wheel)}) return rotatingSource(source, time, local, step, true);
  if (kind == ${String(SourceKind.Spinner)}) return rotatingSource(source, time, local, step, false);
  if (kind == ${String(SourceKind.Tourbillon)}) return climbingSource(source, time, local, step, false);
  if (kind == ${String(SourceKind.Comet)}) return climbingSource(source, time, local, step, true);
  return vec3(0);
}
`;
