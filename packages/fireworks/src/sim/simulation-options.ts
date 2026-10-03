/** Optional source sampling and particle collection controls for stateless simulation. */
import type { ShotPlacement } from './launch';
import type { SprayBirthSink } from './spray';
/** Placement is in metres; spray births retain each source's own clock in seconds. */
export interface SimulationOptions extends ShotPlacement {
  /** Optional deterministic seed override; zero retains the stored seed fallback. */
  seed?: number;
  /** Whether to emit CPU spray points; enabled by default. */
  sprays?: boolean;
  /** Receives sampled births instead of evaluating the CPU spray kernel. */
  sprayBirth?: SprayBirthSink | undefined;
  /** Optional phase boundary observer; true enters spray sampling, false leaves it. */
  sprayPhase?: ((active: boolean) => void) | undefined;
  /** Whether to emit smoke attributes; enabled by default. */
  smoke?: boolean;
  /** Whether to emit flame, blossoms and climb crackle; enabled by default. */
  launchEffects?: boolean;
}
