/** Catalogue height limits in metres, applied to authored templates rather than user designs. */
import type { Design } from '../schema/index';

/** Apex and apex plus largest layer radius limits, both inclusive and in world metres. */
interface HeightBand {
  readonly apex_m: readonly [number, number];
  readonly burst_top_m: readonly [number, number];
}

/** Visual tuning from the catalogue's 5 to 40 m aerial radii: consumer display shells
 * burst at a consistent apex so a show reads as one skyline, with a 105 m ceiling.
 * Mines retain their larger 48 to 52 m radii under a 102 m authored ceiling; their
 * simulation emits from the ground, so this is not a measured particle trajectory.
 * Comets/candles share a travel band. Remaining bands preserve existing ground scale;
 * fountain apex means emitter height and spinner apex is ground level, not plume top. */
const AERIAL_APEX_MIN_M = 55;
const AERIAL_APEX_MAX_M = 65;
const AERIAL_TOP_MIN_M = 60;
const AERIAL_TOP_MAX_M = 105;
const MINE_APEX_MIN_M = 45;
const MINE_APEX_MAX_M = 50;
const MINE_TOP_MIN_M = 93;
const MINE_TOP_MAX_M = 102;
const CLIMB_APEX_MIN_M = 50;
const CLIMB_APEX_MAX_M = 55;
const FOUNTAIN_EMITTER_MIN_M = 0.6;
const FOUNTAIN_EMITTER_MAX_M = 6;
const WHEEL_CENTRE_M = 6;
const TOURBILLON_APEX_MIN_M = 34;
const TOURBILLON_APEX_MAX_M = 38;

/** Per-kind limits in metres; aerial radii and retained ground sizes define these visual bands. */
export const TEMPLATE_HEIGHT_BANDS: Readonly<Record<Design['kind'], HeightBand>> = {
  shell: {
    apex_m: [AERIAL_APEX_MIN_M, AERIAL_APEX_MAX_M],
    burst_top_m: [AERIAL_TOP_MIN_M, AERIAL_TOP_MAX_M],
  },
  rocket: {
    apex_m: [AERIAL_APEX_MIN_M, AERIAL_APEX_MAX_M],
    burst_top_m: [AERIAL_TOP_MIN_M, AERIAL_TOP_MAX_M],
  },
  mine: {
    apex_m: [MINE_APEX_MIN_M, MINE_APEX_MAX_M],
    burst_top_m: [MINE_TOP_MIN_M, MINE_TOP_MAX_M],
  },
  comet: {
    apex_m: [CLIMB_APEX_MIN_M, CLIMB_APEX_MAX_M],
    burst_top_m: [CLIMB_APEX_MIN_M, CLIMB_APEX_MAX_M],
  },
  candle: {
    apex_m: [CLIMB_APEX_MIN_M, CLIMB_APEX_MAX_M],
    burst_top_m: [CLIMB_APEX_MIN_M, CLIMB_APEX_MAX_M],
  },
  fountain: {
    apex_m: [FOUNTAIN_EMITTER_MIN_M, FOUNTAIN_EMITTER_MAX_M],
    burst_top_m: [FOUNTAIN_EMITTER_MIN_M, FOUNTAIN_EMITTER_MAX_M],
  },
  wheel: {
    apex_m: [WHEEL_CENTRE_M, WHEEL_CENTRE_M],
    burst_top_m: [WHEEL_CENTRE_M, WHEEL_CENTRE_M],
  },
  spinner: { apex_m: [0, 0], burst_top_m: [0, 0] },
  tourbillon: {
    apex_m: [TOURBILLON_APEX_MIN_M, TOURBILLON_APEX_MAX_M],
    burst_top_m: [TOURBILLON_APEX_MIN_M, TOURBILLON_APEX_MAX_M],
  },
};

/** Reads the authored apex in metres; ground emitters retain their own height semantics. */
export function templateApexM(design: Design): number {
  if (design.launch) return design.launch.height_m;
  switch (design.kind) {
    case 'comet':
    case 'candle':
      return design.ground.comets.height_m;
    case 'tourbillon':
      return design.ground.tourbillon.height_m;
    case 'fountain':
      return design.ground.fountain.height_m;
    case 'wheel':
      return design.ground.wheel.height_m;
    case 'spinner':
      return 0;
  }
}
