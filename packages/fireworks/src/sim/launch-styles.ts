/** Built-in launch-tail visual tuning selected by the authored launch tail name. */
import type { Launch } from '../schema/index';
export interface LaunchStyle {
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
/** Maps each stored launch tail to its prototype-derived visual controls. */
export const LAUNCH_STYLES: Readonly<Record<Launch['tail'], LaunchStyle>> = {
  gold: { colour: '#ffb45a', head: 0.7, headAlpha: 1 },
  silver: { colour: '#ffffff', head: 1.1, headAlpha: 1 },
  glitter: { colour: '#fff1c8', head: 0.9, headAlpha: 1 },
  comet: { star: true, head: 2.2, headAlpha: 1 },
  crackle: { head: 0.9, headAlpha: 1 },
  whistle: { colour: '#ffffff', head: 1.2, headAlpha: 1, jitter: 0.12 },
  heli: {
    colour: '#fff0c8',
    head: 1.1,
    headAlpha: 1,
    spiral: true,
    spiralR: 1,
    spiralRate: 125,
    spiralKeep: true,
  },
  rocket: { colour: '#ffd38a', head: 1.6, headAlpha: 1, wobble: 0.3 },
  tiger: { colour: '#ff9d3a', head: 1.4, headAlpha: 1 },
  willow: { colour: '#ffb04a', head: 1, headAlpha: 0.8 },
  strobe: { colour: '#eef2ff', head: 1.2, headAlpha: 1, strobe: 9 },
  brocade: { colour: '#ffcf7a', head: 1.2, headAlpha: 1 },
  dark: { head: 0.6, headAlpha: 0.2 },
  flowers: { colour: '#ffc070', head: 1, headAlpha: 1 },
};
