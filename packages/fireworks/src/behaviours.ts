/** Supported geometry strategies and the controls each strategy consumes. */
export const RENDERER_BEHAVIOURS = {
  sphere: { emitter: 'aerial', tuning: null },
  crown: { emitter: 'aerial', tuning: 'crown' },
  weeping: { emitter: 'aerial', tuning: 'weeping' },
  radial_arms: { emitter: 'aerial', tuning: 'radialArms' },
  ring: { emitter: 'aerial', tuning: 'ring' },
  split_cross: { emitter: 'aerial', tuning: null },
  falling_tail: { emitter: 'aerial', tuning: 'fallingTail' },
  single_tail: { emitter: 'aerial', tuning: 'singleTail' },
  upward_fan: { emitter: 'ground', tuning: 'upwardFan' },
  fragment_cloud: { emitter: 'aerial', tuning: 'fragmentCloud' },
  heart: { emitter: 'aerial', tuning: 'heart' },
  five_point_star: { emitter: 'aerial', tuning: 'fivePointStar' },
  pearls: { emitter: 'aerial', tuning: 'pearls' },
  fish: { emitter: 'aerial', tuning: 'fish' },
  waterfall: { emitter: 'aerial', tuning: 'waterfall' },
  whirl: { emitter: 'aerial', tuning: 'whirl' },
  bowtie: { emitter: 'aerial', tuning: 'bowtie' },
  roman_candle: { emitter: 'ground', tuning: 'romanCandle' },
  fountain: { emitter: 'ground', tuning: 'fountain' },
} as const;
export type RendererGeometry = keyof typeof RENDERER_BEHAVIOURS;
export const RENDERER_GEOMETRIES = Object.keys(RENDERER_BEHAVIOURS) as [
  RendererGeometry,
  ...RendererGeometry[],
];
export function isGroundGeometry(geometry: RendererGeometry) {
  return RENDERER_BEHAVIOURS[geometry].emitter === 'ground';
}
