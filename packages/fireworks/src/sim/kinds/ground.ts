/** Dispatches ground effects to their independent source-clock simulations. */
import type { Design } from '../../schema/index';
import type { ShotPlacement } from '../launch';
import type { ParticleWriter } from '../particles';
import { fillComets } from './comets';
import { fillWheel } from './wheel';
import { fillSpinner } from './spinner';
import { fillFountain } from './fountain';
import { fillTourbillon } from './tourbillon';

/** Firing-relative seconds and metre placement shared by all sources of one effect. */
export interface GroundRuntime {
  time: number;
  placement: ShotPlacement;
}
/** Appends a ground frame at runtime.time seconds, with world placement in metres. */
export function fillGround(
  writer: ParticleWriter,
  design: Extract<Design, { launch: null }>,
  seed: number,
  runtime: GroundRuntime,
): void {
  switch (design.kind) {
    case 'comet':
    case 'candle': {
      fillComets(writer, design, seed, runtime);
      return;
    }
    case 'wheel': {
      fillWheel(writer, design, seed, runtime);
      return;
    }
    case 'spinner': {
      fillSpinner(writer, design, seed, runtime);
      return;
    }
    case 'fountain': {
      fillFountain(writer, design, seed, runtime);
      return;
    }
    case 'tourbillon': {
      fillTourbillon(writer, design, seed, runtime);
      return;
    }
  }
}
