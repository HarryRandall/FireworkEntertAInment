/** Built-in launch-tail visual tuning selected by the authored launch tail name. */
import type { Launch } from '../schema/index';
/** Small coloured bursts sampled along a launch path. */
interface LaunchBlossoms {
  /** Number of blossoms distributed across the climb. */
  count: number;
  /** Maximum blossom radius in metres. */
  radius: number;
  /** Blossom lifetime in seconds. */
  life: number;
  /** Optional sRGB palette; omission uses the first burst palette. */
  colours?: string[];
}
/** Prototype-derived source, head, path and smoke controls for a launch tail. */
export interface LaunchStyle {
  /** Human-readable name of the built-in tail. */
  name: string;
  /** Multiplier of the authored launch spark count. */
  sparks: number;
  /** Multiplier of the authored launch ejection speed. */
  spread: number;
  /** Multiplier of the base launch spark size. */
  size: number;
  /** Base spark lifetime in seconds. */
  life: number;
  /** Downward spray acceleration in metres per second squared. */
  gravity: number;
  /** Spray velocity decay coefficient in inverse seconds. */
  drag?: number;
  /** Dimensionless amplitude of random opacity reduction. */
  flicker: number;
  /** Fraction of sparks that ignite as delayed glints. */
  glitter: number;
  /** Base delayed-glint ignition time in seconds. */
  glitterDelay?: number;
  /** Fraction of sparks that split into four children. */
  fork?: number;
  /** Opacity multiplier for climb smoke. */
  smoke: number;
  /** Fraction of launch velocity inherited by sparks. */
  inherit?: number;
  /** Whether to append the rocket motor flame under the head. */
  flame?: boolean;
  /** Optional small bursts distributed along the climb. */
  blossoms?: LaunchBlossoms;
  /** Whether to append short pellet pops along the climb. */
  crackle?: boolean;
  /** Whether the tail carries a whistle sound control. */
  whistle?: boolean;
  /** Optional sRGB head colour; omission uses the simulated burst colour. */
  colour?: string;
  /** Whether the launch head uses its sampled star colour instead of `colour`. */
  star?: boolean;
  /** Head quad size multiplier in renderer pixels. */
  head: number;
  /** Head alpha multiplier in the normalised [0, 1] opacity range. */
  headAlpha: number;
  /** Horizontal sinusoidal displacement amplitude in metres. */
  jitter?: number;
  /** Horizontal launch wobble amplitude in metres. */
  wobble?: number;
  /** Whether the launch path includes a circular spiral offset. */
  spiral?: boolean;
  /** Spiral radius in metres. */
  spiralR?: number;
  /** Spiral angular velocity in radians per second. */
  spiralRate?: number;
  /** Whether the spiral radius remains at its authored size through the climb. */
  spiralKeep?: boolean;
  /** Optional launch strobe rate in hertz. */
  strobe?: number;
}

// Prototype gold tail: sparks (spark-count multiplier), retained visual tuning.
const GOLD_SPARKS = 2.2;
// Prototype gold tail: spread (speed multiplier), retained visual tuning.
const GOLD_SPREAD = 0.5;
// Prototype gold tail: size (size multiplier), retained visual tuning.
const GOLD_SIZE = 1.1;
// Prototype gold tail: life (seconds), retained visual tuning.
const GOLD_LIFE = 1.1;
// Prototype gold tail: gravity (m/s²), retained visual tuning.
const GOLD_GRAVITY = 2;
// Prototype gold tail: flicker (opacity variation), retained visual tuning.
const GOLD_FLICKER = 0.2;
// Prototype gold tail: glitter (probability), retained visual tuning.
const GOLD_GLITTER = 0;
// Prototype gold tail: head (size multiplier), retained visual tuning.
const GOLD_HEAD = 0.7;
// Prototype gold tail: headAlpha (opacity multiplier), retained visual tuning.
const GOLD_HEAD_ALPHA = 1;
// Prototype gold tail: smoke (opacity multiplier), retained visual tuning.
const GOLD_SMOKE = 1;
// Prototype silver tail: sparks (spark-count multiplier), retained visual tuning.
const SILVER_SPARKS = 1.6;
// Prototype silver tail: spread (speed multiplier), retained visual tuning.
const SILVER_SPREAD = 1.3;
// Prototype silver tail: size (size multiplier), retained visual tuning.
const SILVER_SIZE = 0.7;
// Prototype silver tail: life (seconds), retained visual tuning.
const SILVER_LIFE = 0.35;
// Prototype silver tail: gravity (m/s²), retained visual tuning.
const SILVER_GRAVITY = 3;
// Prototype silver tail: flicker (opacity variation), retained visual tuning.
const SILVER_FLICKER = 0.5;
// Prototype silver tail: glitter (probability), retained visual tuning.
const SILVER_GLITTER = 0;
// Prototype silver tail: fork (probability), retained visual tuning.
const SILVER_FORK = 0.2;
// Prototype silver tail: head (size multiplier), retained visual tuning.
const SILVER_HEAD = 1.1;
// Prototype silver tail: headAlpha (opacity multiplier), retained visual tuning.
const SILVER_HEAD_ALPHA = 1;
// Prototype silver tail: smoke (opacity multiplier), retained visual tuning.
const SILVER_SMOKE = 0.8;
// Prototype glitter tail: sparks (spark-count multiplier), retained visual tuning.
const GLITTER_SPARKS = 2;
// Prototype glitter tail: spread (speed multiplier), retained visual tuning.
const GLITTER_SPREAD = 0.8;
// Prototype glitter tail: size (size multiplier), retained visual tuning.
const GLITTER_SIZE = 1;
// Prototype glitter tail: life (seconds), retained visual tuning.
const GLITTER_LIFE = 1.6;
// Prototype glitter tail: gravity (m/s²), retained visual tuning.
const GLITTER_GRAVITY = 2.5;
// Prototype glitter tail: flicker (opacity variation), retained visual tuning.
const GLITTER_FLICKER = 0.1;
// Prototype glitter tail: glitter (probability), retained visual tuning.
const GLITTER_GLITTER = 1;
// Prototype glitter tail: glitterDelay (seconds), retained visual tuning.
const GLITTER_GLITTER_DELAY = 0.4;
// Prototype glitter tail: head (size multiplier), retained visual tuning.
const GLITTER_HEAD = 0.9;
// Prototype glitter tail: headAlpha (opacity multiplier), retained visual tuning.
const GLITTER_HEAD_ALPHA = 1;
// Prototype glitter tail: smoke (opacity multiplier), retained visual tuning.
const GLITTER_SMOKE = 1;
// Prototype comet tail: sparks (spark-count multiplier), retained visual tuning.
const COMET_SPARKS = 1.8;
// Prototype comet tail: spread (speed multiplier), retained visual tuning.
const COMET_SPREAD = 0.9;
// Prototype comet tail: size (size multiplier), retained visual tuning.
const COMET_SIZE = 1.3;
// Prototype comet tail: life (seconds), retained visual tuning.
const COMET_LIFE = 1.1;
// Prototype comet tail: gravity (m/s²), retained visual tuning.
const COMET_GRAVITY = 3;
// Prototype comet tail: flicker (opacity variation), retained visual tuning.
const COMET_FLICKER = 0.2;
// Prototype comet tail: glitter (probability), retained visual tuning.
const COMET_GLITTER = 0;
// Prototype comet tail: head (size multiplier), retained visual tuning.
const COMET_HEAD = 2.2;
// Prototype comet tail: headAlpha (opacity multiplier), retained visual tuning.
const COMET_HEAD_ALPHA = 1;
// Prototype comet tail: smoke (opacity multiplier), retained visual tuning.
const COMET_SMOKE = 1.2;
// Prototype crackle tail: sparks (spark-count multiplier), retained visual tuning.
const CRACKLE_SPARKS = 0.5;
// Prototype crackle tail: spread (speed multiplier), retained visual tuning.
const CRACKLE_SPREAD = 0.8;
// Prototype crackle tail: size (size multiplier), retained visual tuning.
const CRACKLE_SIZE = 0.9;
// Prototype crackle tail: life (seconds), retained visual tuning.
const CRACKLE_LIFE = 0.5;
// Prototype crackle tail: gravity (m/s²), retained visual tuning.
const CRACKLE_GRAVITY = 4;
// Prototype crackle tail: flicker (opacity variation), retained visual tuning.
const CRACKLE_FLICKER = 0.3;
// Prototype crackle tail: glitter (probability), retained visual tuning.
const CRACKLE_GLITTER = 0;
// Prototype crackle tail: head (size multiplier), retained visual tuning.
const CRACKLE_HEAD = 0.9;
// Prototype crackle tail: headAlpha (opacity multiplier), retained visual tuning.
const CRACKLE_HEAD_ALPHA = 1;
// Prototype crackle tail: smoke (opacity multiplier), retained visual tuning.
const CRACKLE_SMOKE = 1;
// Prototype whistle tail: sparks (spark-count multiplier), retained visual tuning.
const WHISTLE_SPARKS = 0.7;
// Prototype whistle tail: spread (speed multiplier), retained visual tuning.
const WHISTLE_SPREAD = 0.3;
// Prototype whistle tail: size (size multiplier), retained visual tuning.
const WHISTLE_SIZE = 0.8;
// Prototype whistle tail: life (seconds), retained visual tuning.
const WHISTLE_LIFE = 0.22;
// Prototype whistle tail: gravity (m/s²), retained visual tuning.
const WHISTLE_GRAVITY = 2;
// Prototype whistle tail: flicker (opacity variation), retained visual tuning.
const WHISTLE_FLICKER = 0.2;
// Prototype whistle tail: glitter (probability), retained visual tuning.
const WHISTLE_GLITTER = 0;
// Prototype whistle tail: head (size multiplier), retained visual tuning.
const WHISTLE_HEAD = 1.2;
// Prototype whistle tail: headAlpha (opacity multiplier), retained visual tuning.
const WHISTLE_HEAD_ALPHA = 1;
// Prototype whistle tail: smoke (opacity multiplier), retained visual tuning.
const WHISTLE_SMOKE = 0.9;
// Prototype whistle tail: jitter (metres), retained visual tuning.
const WHISTLE_JITTER = 0.12;
// Prototype heli tail: sparks (spark-count multiplier), retained visual tuning.
const HELI_SPARKS = 2.5;
// Prototype heli tail: spread (speed multiplier), retained visual tuning.
const HELI_SPREAD = 0.4;
// Prototype heli tail: size (size multiplier), retained visual tuning.
const HELI_SIZE = 0.9;
// Prototype heli tail: life (seconds), retained visual tuning.
const HELI_LIFE = 0.35;
// Prototype heli tail: gravity (m/s²), retained visual tuning.
const HELI_GRAVITY = 5;
// Prototype heli tail: flicker (opacity variation), retained visual tuning.
const HELI_FLICKER = 0.3;
// Prototype heli tail: glitter (probability), retained visual tuning.
const HELI_GLITTER = 0;
// Prototype heli tail: head (size multiplier), retained visual tuning.
const HELI_HEAD = 1.1;
// Prototype heli tail: headAlpha (opacity multiplier), retained visual tuning.
const HELI_HEAD_ALPHA = 1;
// Prototype heli tail: smoke (opacity multiplier), retained visual tuning.
const HELI_SMOKE = 0.8;
// Prototype heli tail: spiralR (metres), retained visual tuning.
const HELI_SPIRAL_R = 1;
// Prototype heli tail: spiralRate (rad/s), retained visual tuning.
const HELI_SPIRAL_RATE = 125;
// Prototype heli tail: inherit (velocity fraction), retained visual tuning.
const HELI_INHERIT = 0.08;
// Prototype rocket tail: sparks (spark-count multiplier), retained visual tuning.
const ROCKET_SPARKS = 3;
// Prototype rocket tail: spread (speed multiplier), retained visual tuning.
const ROCKET_SPREAD = 0.8;
// Prototype rocket tail: size (size multiplier), retained visual tuning.
const ROCKET_SIZE = 1.4;
// Prototype rocket tail: life (seconds), retained visual tuning.
const ROCKET_LIFE = 1.2;
// Prototype rocket tail: gravity (m/s²), retained visual tuning.
const ROCKET_GRAVITY = 3;
// Prototype rocket tail: flicker (opacity variation), retained visual tuning.
const ROCKET_FLICKER = 0.3;
// Prototype rocket tail: glitter (probability), retained visual tuning.
const ROCKET_GLITTER = 0.2;
// Prototype rocket tail: head (size multiplier), retained visual tuning.
const ROCKET_HEAD = 1.6;
// Prototype rocket tail: headAlpha (opacity multiplier), retained visual tuning.
const ROCKET_HEAD_ALPHA = 1;
// Prototype rocket tail: smoke (opacity multiplier), retained visual tuning.
const ROCKET_SMOKE = 1.6;
// Prototype rocket tail: wobble (metres), retained visual tuning.
const ROCKET_WOBBLE = 0.3;
// Prototype tiger tail: sparks (spark-count multiplier), retained visual tuning.
const TIGER_SPARKS = 4;
// Prototype tiger tail: spread (speed multiplier), retained visual tuning.
const TIGER_SPREAD = 0.6;
// Prototype tiger tail: size (size multiplier), retained visual tuning.
const TIGER_SIZE = 1.5;
// Prototype tiger tail: life (seconds), retained visual tuning.
const TIGER_LIFE = 2;
// Prototype tiger tail: gravity (m/s²), retained visual tuning.
const TIGER_GRAVITY = 1.2;
// Prototype tiger tail: drag (1/s), retained visual tuning.
const TIGER_DRAG = 1.2;
// Prototype tiger tail: flicker (opacity variation), retained visual tuning.
const TIGER_FLICKER = 0.15;
// Prototype tiger tail: glitter (probability), retained visual tuning.
const TIGER_GLITTER = 0;
// Prototype tiger tail: head (size multiplier), retained visual tuning.
const TIGER_HEAD = 1.4;
// Prototype tiger tail: headAlpha (opacity multiplier), retained visual tuning.
const TIGER_HEAD_ALPHA = 1;
// Prototype tiger tail: smoke (opacity multiplier), retained visual tuning.
const TIGER_SMOKE = 1.4;
// Prototype tiger tail: inherit (velocity fraction), retained visual tuning.
const TIGER_INHERIT = 0.1;
// Prototype willow tail: sparks (spark-count multiplier), retained visual tuning.
const WILLOW_SPARKS = 2;
// Prototype willow tail: spread (speed multiplier), retained visual tuning.
const WILLOW_SPREAD = 0.6;
// Prototype willow tail: size (size multiplier), retained visual tuning.
const WILLOW_SIZE = 1;
// Prototype willow tail: life (seconds), retained visual tuning.
const WILLOW_LIFE = 2.2;
// Prototype willow tail: gravity (m/s²), retained visual tuning.
const WILLOW_GRAVITY = 2.5;
// Prototype willow tail: flicker (opacity variation), retained visual tuning.
const WILLOW_FLICKER = 0.1;
// Prototype willow tail: glitter (probability), retained visual tuning.
const WILLOW_GLITTER = 0;
// Prototype willow tail: head (size multiplier), retained visual tuning.
const WILLOW_HEAD = 1;
// Prototype willow tail: headAlpha (opacity multiplier), retained visual tuning.
const WILLOW_HEAD_ALPHA = 0.8;
// Prototype willow tail: smoke (opacity multiplier), retained visual tuning.
const WILLOW_SMOKE = 1;
// Prototype willow tail: inherit (velocity fraction), retained visual tuning.
const WILLOW_INHERIT = 0.05;
// Prototype strobe tail: sparks (spark-count multiplier), retained visual tuning.
const STROBE_SPARKS = 0.25;
// Prototype strobe tail: spread (speed multiplier), retained visual tuning.
const STROBE_SPREAD = 0.5;
// Prototype strobe tail: size (size multiplier), retained visual tuning.
const STROBE_SIZE = 0.7;
// Prototype strobe tail: life (seconds), retained visual tuning.
const STROBE_LIFE = 0.3;
// Prototype strobe tail: gravity (m/s²), retained visual tuning.
const STROBE_GRAVITY = 3;
// Prototype strobe tail: flicker (opacity variation), retained visual tuning.
const STROBE_FLICKER = 0.2;
// Prototype strobe tail: glitter (probability), retained visual tuning.
const STROBE_GLITTER = 0;
// Prototype strobe tail: head (size multiplier), retained visual tuning.
const STROBE_HEAD = 1.2;
// Prototype strobe tail: headAlpha (opacity multiplier), retained visual tuning.
const STROBE_HEAD_ALPHA = 1;
// Prototype strobe tail: smoke (opacity multiplier), retained visual tuning.
const STROBE_SMOKE = 0.6;
// Prototype strobe tail: strobe (Hz), retained visual tuning.
const STROBE_STROBE = 9;
// Prototype brocade tail: sparks (spark-count multiplier), retained visual tuning.
const BROCADE_SPARKS = 1.8;
// Prototype brocade tail: spread (speed multiplier), retained visual tuning.
const BROCADE_SPREAD = 1;
// Prototype brocade tail: size (size multiplier), retained visual tuning.
const BROCADE_SIZE = 1.1;
// Prototype brocade tail: life (seconds), retained visual tuning.
const BROCADE_LIFE = 1.3;
// Prototype brocade tail: gravity (m/s²), retained visual tuning.
const BROCADE_GRAVITY = 4;
// Prototype brocade tail: flicker (opacity variation), retained visual tuning.
const BROCADE_FLICKER = 0.1;
// Prototype brocade tail: glitter (probability), retained visual tuning.
const BROCADE_GLITTER = 0.55;
// Prototype brocade tail: head (size multiplier), retained visual tuning.
const BROCADE_HEAD = 1.2;
// Prototype brocade tail: headAlpha (opacity multiplier), retained visual tuning.
const BROCADE_HEAD_ALPHA = 1;
// Prototype brocade tail: smoke (opacity multiplier), retained visual tuning.
const BROCADE_SMOKE = 1.1;
// Prototype brocade tail: inherit (velocity fraction), retained visual tuning.
const BROCADE_INHERIT = 0.08;
// Prototype dark tail: sparks (spark-count multiplier), retained visual tuning.
const DARK_SPARKS = 0.08;
// Prototype dark tail: spread (speed multiplier), retained visual tuning.
const DARK_SPREAD = 0.6;
// Prototype dark tail: size (size multiplier), retained visual tuning.
const DARK_SIZE = 0.8;
// Prototype dark tail: life (seconds), retained visual tuning.
const DARK_LIFE = 0.35;
// Prototype dark tail: gravity (m/s²), retained visual tuning.
const DARK_GRAVITY = 3;
// Prototype dark tail: flicker (opacity variation), retained visual tuning.
const DARK_FLICKER = 0.4;
// Prototype dark tail: glitter (probability), retained visual tuning.
const DARK_GLITTER = 0;
// Prototype dark tail: head (size multiplier), retained visual tuning.
const DARK_HEAD = 0.6;
// Prototype dark tail: headAlpha (opacity multiplier), retained visual tuning.
const DARK_HEAD_ALPHA = 0.2;
// Prototype dark tail: smoke (opacity multiplier), retained visual tuning.
const DARK_SMOKE = 0.5;
// Prototype flowers tail: sparks (spark-count multiplier), retained visual tuning.
const FLOWERS_SPARKS = 1.2;
// Prototype flowers tail: spread (speed multiplier), retained visual tuning.
const FLOWERS_SPREAD = 0.5;
// Prototype flowers tail: size (size multiplier), retained visual tuning.
const FLOWERS_SIZE = 0.9;
// Prototype flowers tail: life (seconds), retained visual tuning.
const FLOWERS_LIFE = 0.8;
// Prototype flowers tail: gravity (m/s²), retained visual tuning.
const FLOWERS_GRAVITY = 2;
// Prototype flowers tail: flicker (opacity variation), retained visual tuning.
const FLOWERS_FLICKER = 0.2;
// Prototype flowers tail: glitter (probability), retained visual tuning.
const FLOWERS_GLITTER = 0;
// Prototype flowers tail: head (size multiplier), retained visual tuning.
const FLOWERS_HEAD = 1;
// Prototype flowers tail: headAlpha (opacity multiplier), retained visual tuning.
const FLOWERS_HEAD_ALPHA = 1;
// Prototype flowers tail: smoke (opacity multiplier), retained visual tuning.
const FLOWERS_SMOKE = 0.9;
// Prototype rising flowers: blossom count (blossoms), retained visual tuning.
const FLOWERS_BLOSSOM_COUNT = 6;
// Prototype rising flowers: blossom radius (metres), retained visual tuning.
const FLOWERS_BLOSSOM_RADIUS = 3;
// Prototype rising flowers: blossom life (seconds), retained visual tuning.
const FLOWERS_BLOSSOM_LIFE = 0.55;

/** Maps each stored launch tail to its prototype-derived visual controls. */
export const LAUNCH_STYLES: Readonly<Record<Launch['tail'], LaunchStyle>> = {
  gold: {
    name: 'Gold tail',
    colour: '#ffb45a',
    sparks: GOLD_SPARKS,
    spread: GOLD_SPREAD,
    size: GOLD_SIZE,
    life: GOLD_LIFE,
    gravity: GOLD_GRAVITY,
    flicker: GOLD_FLICKER,
    glitter: GOLD_GLITTER,
    head: GOLD_HEAD,
    headAlpha: GOLD_HEAD_ALPHA,
    smoke: GOLD_SMOKE,
  },

  silver: {
    name: 'Silver tail',
    colour: '#ffffff',
    sparks: SILVER_SPARKS,
    spread: SILVER_SPREAD,
    size: SILVER_SIZE,
    life: SILVER_LIFE,
    gravity: SILVER_GRAVITY,
    flicker: SILVER_FLICKER,
    glitter: SILVER_GLITTER,
    fork: SILVER_FORK,
    head: SILVER_HEAD,
    headAlpha: SILVER_HEAD_ALPHA,
    smoke: SILVER_SMOKE,
  },

  glitter: {
    name: 'Glittering tail',
    colour: '#fff1c8',
    sparks: GLITTER_SPARKS,
    spread: GLITTER_SPREAD,
    size: GLITTER_SIZE,
    life: GLITTER_LIFE,
    gravity: GLITTER_GRAVITY,
    flicker: GLITTER_FLICKER,
    glitter: GLITTER_GLITTER,
    glitterDelay: GLITTER_GLITTER_DELAY,
    head: GLITTER_HEAD,
    headAlpha: GLITTER_HEAD_ALPHA,
    smoke: GLITTER_SMOKE,
  },
  comet: {
    name: 'Rising comet',
    star: true,
    sparks: COMET_SPARKS,
    spread: COMET_SPREAD,
    size: COMET_SIZE,
    life: COMET_LIFE,
    gravity: COMET_GRAVITY,
    flicker: COMET_FLICKER,
    glitter: COMET_GLITTER,
    head: COMET_HEAD,
    headAlpha: COMET_HEAD_ALPHA,
    smoke: COMET_SMOKE,
  },
  crackle: {
    name: 'Crackling tail',
    sparks: CRACKLE_SPARKS,
    spread: CRACKLE_SPREAD,
    size: CRACKLE_SIZE,
    life: CRACKLE_LIFE,
    gravity: CRACKLE_GRAVITY,
    flicker: CRACKLE_FLICKER,
    glitter: CRACKLE_GLITTER,
    head: CRACKLE_HEAD,
    headAlpha: CRACKLE_HEAD_ALPHA,
    smoke: CRACKLE_SMOKE,
    crackle: true,
  },
  whistle: {
    name: 'Whistle',
    colour: '#ffffff',
    sparks: WHISTLE_SPARKS,
    spread: WHISTLE_SPREAD,
    size: WHISTLE_SIZE,
    life: WHISTLE_LIFE,
    gravity: WHISTLE_GRAVITY,
    flicker: WHISTLE_FLICKER,
    glitter: WHISTLE_GLITTER,
    head: WHISTLE_HEAD,
    headAlpha: WHISTLE_HEAD_ALPHA,
    smoke: WHISTLE_SMOKE,
    jitter: WHISTLE_JITTER,
    whistle: true,
  },

  heli: {
    name: 'Helicopter spin',
    colour: '#fff0c8',
    sparks: HELI_SPARKS,
    spread: HELI_SPREAD,
    size: HELI_SIZE,
    life: HELI_LIFE,
    gravity: HELI_GRAVITY,
    flicker: HELI_FLICKER,
    glitter: HELI_GLITTER,
    head: HELI_HEAD,
    headAlpha: HELI_HEAD_ALPHA,
    smoke: HELI_SMOKE,
    spiral: true,
    spiralR: HELI_SPIRAL_R,
    spiralRate: HELI_SPIRAL_RATE,
    spiralKeep: true,
    // Sparks fly off the spinning rotor at a fraction of its speed: a disc a few metres wide.
    inherit: HELI_INHERIT,
    whistle: true,
  },

  rocket: {
    name: 'Rocket tail',
    colour: '#ffd38a',
    sparks: ROCKET_SPARKS,
    spread: ROCKET_SPREAD,
    size: ROCKET_SIZE,
    life: ROCKET_LIFE,
    gravity: ROCKET_GRAVITY,
    flicker: ROCKET_FLICKER,
    glitter: ROCKET_GLITTER,
    head: ROCKET_HEAD,
    headAlpha: ROCKET_HEAD_ALPHA,
    smoke: ROCKET_SMOKE,
    wobble: ROCKET_WOBBLE,
    flame: true,
  },

  tiger: {
    name: 'Tiger tail',
    colour: '#ff9d3a',
    sparks: TIGER_SPARKS,
    spread: TIGER_SPREAD,
    size: TIGER_SIZE,
    life: TIGER_LIFE,
    gravity: TIGER_GRAVITY,
    drag: TIGER_DRAG,
    flicker: TIGER_FLICKER,
    glitter: TIGER_GLITTER,
    head: TIGER_HEAD,
    headAlpha: TIGER_HEAD_ALPHA,
    smoke: TIGER_SMOKE,
    inherit: TIGER_INHERIT,
  },

  willow: {
    name: 'Willow tail',
    colour: '#ffb04a',
    sparks: WILLOW_SPARKS,
    spread: WILLOW_SPREAD,
    size: WILLOW_SIZE,
    life: WILLOW_LIFE,
    gravity: WILLOW_GRAVITY,
    flicker: WILLOW_FLICKER,
    glitter: WILLOW_GLITTER,
    head: WILLOW_HEAD,
    headAlpha: WILLOW_HEAD_ALPHA,
    smoke: WILLOW_SMOKE,
    inherit: WILLOW_INHERIT,
  },
  strobe: {
    name: 'Strobing climb',
    colour: '#eef2ff',
    sparks: STROBE_SPARKS,
    spread: STROBE_SPREAD,
    size: STROBE_SIZE,
    life: STROBE_LIFE,
    gravity: STROBE_GRAVITY,
    flicker: STROBE_FLICKER,
    glitter: STROBE_GLITTER,
    head: STROBE_HEAD,
    headAlpha: STROBE_HEAD_ALPHA,
    smoke: STROBE_SMOKE,
    strobe: STROBE_STROBE,
  },
  brocade: {
    name: 'Brocade tail',
    colour: '#ffcf7a',
    sparks: BROCADE_SPARKS,
    spread: BROCADE_SPREAD,
    size: BROCADE_SIZE,
    life: BROCADE_LIFE,
    gravity: BROCADE_GRAVITY,
    flicker: BROCADE_FLICKER,
    glitter: BROCADE_GLITTER,
    head: BROCADE_HEAD,
    headAlpha: BROCADE_HEAD_ALPHA,
    smoke: BROCADE_SMOKE,
    inherit: BROCADE_INHERIT,
  },
  dark: {
    name: 'Dark climb',
    sparks: DARK_SPARKS,
    spread: DARK_SPREAD,
    size: DARK_SIZE,
    life: DARK_LIFE,
    gravity: DARK_GRAVITY,
    flicker: DARK_FLICKER,
    glitter: DARK_GLITTER,
    head: DARK_HEAD,
    headAlpha: DARK_HEAD_ALPHA,
    smoke: DARK_SMOKE,
  },
  flowers: {
    name: 'Rising flowers',
    colour: '#ffc070',
    sparks: FLOWERS_SPARKS,
    spread: FLOWERS_SPREAD,
    size: FLOWERS_SIZE,
    life: FLOWERS_LIFE,
    gravity: FLOWERS_GRAVITY,
    flicker: FLOWERS_FLICKER,
    glitter: FLOWERS_GLITTER,
    head: FLOWERS_HEAD,
    headAlpha: FLOWERS_HEAD_ALPHA,
    smoke: FLOWERS_SMOKE,
    blossoms: {
      count: FLOWERS_BLOSSOM_COUNT,
      radius: FLOWERS_BLOSSOM_RADIUS,
      life: FLOWERS_BLOSSOM_LIFE,
    },
  },
};
