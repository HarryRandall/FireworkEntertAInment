/** Public DOM-free firework simulation API. */
export { simulate, type SimulationOptions } from './shell';
export { shotDuration } from './timing';
export { ParticleKind, type Particles, type SmokeParticles } from './particles';
export { launchPos, MUZZLE_M, type ShotPlacement } from './launch';
export { starPos } from './motion';
export { hash } from './random';
export { directions, unit, type StarDirection } from './directions';
export { rgb, colourAt, brightnessAt, type Vec3 } from './colour';
export {
  spraySlots,
  sparkState,
  type SprayOptions,
  type SpraySlot,
  type SprayBirthSink,
} from './spray';
export { WIND } from './smoke';
