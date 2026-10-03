/** Test-only Float64 port of sampleBirth/sampleSource. Never used by the renderer. */
import { packTrajectory } from '../src/view/source-trajectory.ts';
import { packSourcePhases } from '../src/view/source-phases.ts';
import {
  sourceLane as L,
  SourceKind as K,
  SourceModifier as M,
  SOURCE_SCALARS,
} from '../src/view/source-layout.ts';
import { motionTuning as T } from '../src/view/source-motion-kernel.ts';

// GLSL hashWord/sparkHash port: unsigned 32-bit mixing, evaluated independently of the CPU hash.
function hash(a, b, c) {
  let word =
    Math.imul(a >>> 0, 0x9e3779b1) ^
    Math.imul((b >>> 0) + 0x7f4a7c15, 0x85ebca77) ^
    Math.imul((c >>> 0) + 0x165667b1, 0xc2b2ae3d);
  word = Math.imul(word ^ (word >>> 16), 0x85ebca6b);
  word = Math.imul(word ^ (word >>> 13), 0xc2b2ae35);
  return ((word ^ (word >>> 16)) >>> 0) / 4294967296;
}

const STEP_S = 0.016; // CPU and GLSL one-sided finite-difference interval, seconds.
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
function wheelAdvance(anchor, local) {
  const time = anchor + local;
  if (anchor < 1 && time < 1) return local * (anchor + local * 0.5);
  if (anchor < 1) return local - 0.5 * (anchor - 1) ** 2;
  if (time < 1) return local + 0.5 * (time - 1) ** 2;
  return local;
}
function sampler(data, anchor, trigonometry) {
  const shiftedSin = (angle, advance) =>
    trigonometry.sin(angle) * trigonometry.cos(advance) +
    trigonometry.cos(angle) * trigonometry.sin(advance);
  const shiftedCos = (angle, advance) =>
    trigonometry.cos(angle) * trigonometry.cos(advance) -
    trigonometry.sin(angle) * trigonometry.sin(advance);
  const lane = (name) => Array.from(data.slice(name * 4, name * 4 + 4));
  const phase = (index, rate, local) => data[L.phases * 4 + index] + local * rate;
  const modifierPhase = (index, harmonic, rate, local) =>
    data[(L.modifierPhases + index * 2) * 4 + harmonic] + local * rate;
  const origin = lane(L.origin);
  const travel = lane(L.travel);
  const shape = lane(L.shape);
  const kind = lane(L.trajectory)[0];
  return (birthTime, local, step) => {
    const time = birthTime + step;
    if (kind === K.Wheel) {
      const angle = phase(0, travel[1], wheelAdvance(anchor, local));
      const advance = travel[1] * wheelAdvance(birthTime, step);
      return [shiftedCos(angle, advance) * travel[0], shiftedSin(angle, advance) * travel[0], 0];
    }
    if (kind === K.Launch) {
      const progress = clamp(time / travel[1], 0, 1);
      const height = origin[1] + (travel[0] - origin[1]) * (1 - (1 - progress) ** 2);
      const clear = clamp((height - origin[1]) / T.CLEARANCE_M, 0, 1);
      const sine = (index, rate) => shiftedSin(phase(index, rate, local), rate * step);
      const cosine = (index, rate) => shiftedCos(phase(index, rate, local), rate * step);
      const decay = lane(L.embellishment)[0] !== 0 ? 1 : 1 - Math.min(1, time / travel[1]);
      const radius = shape[2] * decay * clear;
      return [
        travel[2] * height +
          sine(0, T.CLIMB_SWAY_RAD_S) * T.CLIMB_SWAY_M * clear +
          sine(1, T.JITTER_X_RAD_S) * shape[0] * clear +
          sine(3, T.WOBBLE_X_RAD_S) * shape[1] * clear +
          cosine(5, shape[3]) * radius,
        height - origin[1],
        cosine(2, T.JITTER_Z_RAD_S) * shape[0] * clear +
          cosine(4, T.WOBBLE_Z_RAD_S) * shape[1] * T.WOBBLE_Z_SCALE * clear +
          sine(5, shape[3]) * radius,
      ];
    }
    if (kind === K.Star) {
      const direction = lane(L.starDirection).slice(0, 3);
      const rotated = [...direction];
      const count = lane(L.starPhase)[1];
      for (let index = 0; index < count; index++) {
        const modifier = lane(L.modifiers + index);
        if (modifier[0] !== M.Twist) continue;
        const angle = modifierPhase(index, 0, modifier[1], local);
        const cosine = shiftedCos(angle, modifier[1] * step);
        const sine = shiftedSin(angle, modifier[1] * step);
        const x = rotated[0];
        if (modifier[2] !== 0) {
          rotated[0] = x * cosine - rotated[1] * sine;
          rotated[1] = x * sine + rotated[1] * cosine;
        } else {
          rotated[0] = x * cosine + rotated[2] * sine;
          rotated[2] = -x * sine + rotated[2] * cosine;
        }
      }
      const fraction = 1 - Math.exp(-travel[1] * time);
      const position = rotated.map((value) => value * travel[0] * fraction);
      position[1] -= (travel[2] / travel[1]) * (time - fraction / travel[1]);
      for (let index = 0; index < count; index++) {
        const modifier = lane(L.modifiers + index);
        const sine = (harmonic, rate) =>
          shiftedSin(modifierPhase(index, harmonic, rate, local), rate * step);
        const cosine = (harmonic, rate) =>
          shiftedCos(modifierPhase(index, harmonic, rate, local), rate * step);
        if (modifier[0] === M.Flutter) {
          const amplitude =
            Math.min(1, time * T.FLUTTER_RISE_PER_S) *
            T.FLUTTER_RADIUS_FRACTION *
            travel[3] *
            modifier[1];
          position[0] += sine(0, T.FLUTTER_X_RAD_S) * amplitude;
          position[2] += cosine(1, T.FLUTTER_Z_RAD_S) * amplitude;
        } else if (modifier[0] === M.Fish) {
          const wave =
            sine(0, modifier[1]) *
            T.FISH_WAVE_M *
            modifier[2] *
            Math.min(1, time * T.FISH_RISE_PER_S);
          const length = Math.hypot(direction[0], direction[1]) || 1;
          position[0] += (-direction[1] / length) * wave;
          position[1] +=
            (direction[0] / length) * wave +
            cosine(1, modifier[1] * T.FISH_VERTICAL_RATIO) * T.FISH_VERTICAL_M;
        } else if (modifier[0] === M.Bees) {
          const amplitude = Math.min(1, time * T.BEE_RISE_PER_S) * T.BEE_REACH_M;
          position[0] +=
            (sine(0, T.BEE_RATE_RAD_S * T.BEE_X_RATE) +
              sine(1, T.BEE_RATE_RAD_S * T.BEE_X_HARMONIC) * 0.5) *
            amplitude;
          position[1] +=
            (sine(2, T.BEE_RATE_RAD_S * T.BEE_Y_RATE) +
              sine(3, T.BEE_RATE_RAD_S * T.BEE_Y_HARMONIC) * 0.5) *
            amplitude;
          position[2] +=
            (sine(4, T.BEE_RATE_RAD_S * T.BEE_Z_RATE) +
              sine(5, T.BEE_RATE_RAD_S * T.BEE_Z_HARMONIC) * 0.5) *
            amplitude;
        }
      }
      return position;
    }
    if (kind === K.Fixed) return [0, 0, 0];
    throw new Error(`Unported diagnostic trajectory ${kind}`);
  };
}

/** Evaluates live candidate birth lanes in metres, m/s and source seconds, with no Float32 arithmetic.
 * roundedInputs selects uploaded Float32 controls; false isolates the formula from upload quantisation. */
export function mirrorBirth(input, candidate, roundedInputs = false, trigonometry = Math) {
  const { trajectory, options, start, end, now, candidateStart } = input;
  const interval = (options.life / options.count) * 1.15;
  const lastSlot = Math.floor(Math.min(now, end) / interval);
  const anchor = lastSlot * interval;
  const data = new Float64Array(SOURCE_SCALARS);
  packTrajectory(data, 0, trajectory);
  packSourcePhases(data, trajectory, anchor);
  const samples = Math.max(options.fork ? 4 : 1, 1 + Math.min(16, options.streak ?? 0));
  const cluster = Math.ceil(options.cluster || 3.4);
  const sparkIndex = Math.floor((candidate - candidateStart) / samples);
  const slot = lastSlot - Math.floor(sparkIndex / cluster);
  const id = slot * 7 + (sparkIndex % cluster);
  const round = roundedInputs ? Math.fround : (value) => value;
  const local = (slot - lastSlot + hash(id, options.seed, 1)) * round(interval);
  const time = round(anchor) + local;
  const age = round(now - anchor) - local;
  const controls = roundedInputs ? new Float32Array(data) : data;
  const sample = sampler(controls, round(anchor), trigonometry);
  const origin = sample(time, local, 0).map((value, axis) => value + controls[L.origin * 4 + axis]);
  const back = time + STEP_S > round(end);
  const before = sample(time, local, back ? -STEP_S : 0);
  const after = sample(time, local, back ? 0 : STEP_S);
  const inherited = after.map(
    (value, axis) => ((value - before[axis]) / STEP_S) * round(options.inherit ?? 0.22),
  );
  const random = hash(id, options.seed, 2);
  const shortLife = 0.7 * random + 0.3;
  let tail = random * random;
  tail *= tail;
  tail *= tail;
  tail *= tail;
  const life = round(options.life) * 1.75 * (0.7 * shortLife * shortLife + 0.3 * tail);
  const fade = Array.from(controls.slice(L.fade * 4, L.fade * 4 + 4));
  let alpha = options.alpha ?? 1;
  if (fade[0] !== 0) {
    const progress = time / fade[2];
    alpha = Math.min(1, time / 0.07);
    if (progress > fade[1]) alpha *= Math.max(0, 1 - (progress - fade[1]) / (1 - fade[1]));
    if (progress > 0.92) alpha *= Math.max(0, (1 - progress) / 0.08);
  }
  const firstSlot = Math.max(
    Math.floor(round(start) / round(interval)),
    Math.floor(
      (round(anchor) + round(now - anchor) - round(options.life) * 1.75) / round(interval),
    ),
  );
  const clusterSize = 1 + Math.floor(hash(slot, options.seed, 9) * round(options.cluster || 3.4));
  const visible =
    slot >= firstSlot &&
    sparkIndex % cluster < clusterSize &&
    time >= round(start) &&
    time <= round(end) &&
    time <= round(anchor) + round(now - anchor) &&
    age <= life &&
    alpha > 0.004;
  return { origin, inherited, time, age, life, alpha, id, local, back, visible };
}
