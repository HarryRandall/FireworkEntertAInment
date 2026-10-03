/** Slow-burning and embellished launch-tail controls derived from the prototype. */
import type { LaunchStyle } from './launch-styles';
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
/** Authored tail families with longer embers or brightness embellishments. */
export const EMBELLISHED_LAUNCH_STYLES = {
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
} as const satisfies Record<string, LaunchStyle>;
