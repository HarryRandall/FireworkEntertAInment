import type { Launch } from '../schema/index';
export interface LaunchStyle {
  colour?: string;
  star?: boolean;
  head: number;
  headAlpha: number;
  jitter?: number;
  wobble?: number;
  spiral?: boolean;
  spiralR?: number;
  spiralRate?: number;
  spiralKeep?: boolean;
  strobe?: number;
}
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
