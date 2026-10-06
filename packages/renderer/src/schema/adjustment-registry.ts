/** Editor-facing metadata for the persisted quick-adjustment controls. */
export interface AdjustmentDefinition {
  /** Persisted adjustment key, optionally with a `{id}` layer placeholder. */
  key: string;
  /** Authored design fields changed by this adjustment. */
  targets: readonly string[];
  /** Human-readable per-level transformation for editor presentation. */
  perLevel: string;
  /** Optional human-readable bounds applied after the transformation. */
  clamp?: string;
}

/** Maps saved Finale-style adjective controls to authored v1 fields and editor descriptions. */
export const ADJUSTMENT_REGISTRY = {
  'launch.height': {
    key: 'launch.height',
    targets: ['launch.height_m', 'launch.time_s'],
    perLevel: 'height × 1.12; climb time × √height factor',
    clamp: 'height_m 0..1000; time_s 0.001..120',
  },
  'launch.tail': {
    key: 'launch.tail',
    targets: ['launch.sparks', 'launch.spread'],
    perLevel: 'sparks × 1.35; spread × 1.15',
    clamp: 'sparks 0..10000; spread 0..20',
  },
  'launch.climb': {
    key: 'launch.climb',
    targets: ['launch.time_s'],
    perLevel: 'time × 0.85',
    clamp: 'time_s 0.001..120',
  },
  'break.flash': {
    key: 'break.flash',
    targets: ['breaks[].core.flash'],
    perLevel: 'flash × 1.3',
    clamp: 'flash 0..10',
  },
  'break.core_ring': {
    key: 'break.core_ring',
    targets: ['breaks[].core.radius'],
    perLevel: 'radius × 1.15',
    clamp: 'radius 0..4',
  },
  'ground.height': {
    key: 'ground.height',
    targets: [
      'ground.comets.height_m',
      'ground.comets.time_s',
      'ground.tourbillon.height_m',
      'ground.tourbillon.time_s',
      'ground.fountain.speed_m_s',
    ],
    perLevel: 'climb height × 1.12 and time × √height factor; fountain speed × 1.1',
  },
  'ground.count': {
    key: 'ground.count',
    targets: ['ground.comets.count', 'ground.tourbillon.count'],
    perLevel: 'comets +1 or +2; tourbillon +1',
    clamp: 'count 1..500',
  },
  'ground.fan': {
    key: 'ground.fan',
    targets: ['ground.comets.spread_deg'],
    perLevel: 'spread × 1.25',
    clamp: 'spread_deg 0..120',
  },
  'ground.climb': {
    key: 'ground.climb',
    targets: ['ground.comets.time_s', 'ground.tourbillon.time_s'],
    perLevel: 'time × 0.85',
    clamp: 'time_s 0.001..120',
  },
  'ground.star_size': {
    key: 'ground.star_size',
    targets: ['ground.comets.size'],
    perLevel: 'size × 1.15',
    clamp: 'size 0..10',
  },
  'ground.spin': {
    key: 'ground.spin',
    targets: ['ground.comets.spin_rad_s', 'ground.tourbillon.spin_rad_s'],
    perLevel: 'comets +4 rad/s; tourbillon × 1.25',
    clamp: 'spin_rad_s 0..500',
  },
  'ground.duration': {
    key: 'ground.duration',
    targets: ['ground.fountain.duration_s'],
    perLevel: 'duration × 1.2',
    clamp: 'duration_s 0.001..120',
  },
  'ground.density': {
    key: 'ground.density',
    targets: ['ground.fountain.rate_per_s'],
    perLevel: 'rate × 1.25',
    clamp: 'rate_per_s 0..20000',
  },
  'ground.spray': {
    key: 'ground.spray',
    targets: ['ground.fountain.cone'],
    perLevel: 'cone × 1.25',
    clamp: 'cone 0..4',
  },
  'layer.{id}.size': {
    key: 'layer.{id}.size',
    targets: ['layer.radius_m'],
    perLevel: 'radius × 1.15',
    clamp: 'radius_m 0..500',
  },
  'layer.{id}.stars': {
    key: 'layer.{id}.stars',
    targets: ['layer.count'],
    perLevel: 'count × 1.3',
    clamp: 'count 3..10000',
  },
  'layer.{id}.brightness': {
    key: 'layer.{id}.brightness',
    targets: ['layer.brightness[].value'],
    perLevel: 'brightness × 1.2',
    clamp: 'value 0..10',
  },
  'layer.{id}.burn': {
    key: 'layer.{id}.burn',
    targets: ['layer.life_s'],
    perLevel: 'life × 1.25',
    clamp: 'life_s 0.001..120',
  },
  'layer.{id}.droop': {
    key: 'layer.{id}.droop',
    targets: ['layer.gravity_m_s2'],
    perLevel: 'gravity × 1.35',
    clamp: 'gravity_m_s2 -40..100',
  },
  'layer.{id}.spread': {
    key: 'layer.{id}.spread',
    targets: ['layer.speed_var'],
    perLevel: 'speed variance +0.12',
    clamp: 'speed_var 0..0.9',
  },
  'layer.{id}.star_size': {
    key: 'layer.{id}.star_size',
    targets: ['layer.head.size'],
    perLevel: 'size × 1.2',
    clamp: 'size 0..10',
  },
  'layer.{id}.trail.length': {
    key: 'layer.{id}.trail.length',
    targets: ['layer.trail.length_s'],
    perLevel: 'length × 1.3',
    clamp: 'length_s 0.001..20',
  },
  'layer.{id}.trail.density': {
    key: 'layer.{id}.trail.density',
    targets: ['layer.trail.sparks'],
    perLevel: 'sparks × 1.35',
    clamp: 'sparks 0..10000',
  },
  'layer.{id}.trail.spray': {
    key: 'layer.{id}.trail.spray',
    targets: ['layer.trail.spread_m_s'],
    perLevel: 'spread × 1.3',
    clamp: 'spread_m_s 0..200',
  },
  'layer.{id}.trail.glitter': {
    key: 'layer.{id}.trail.glitter',
    targets: ['layer.trail.glitter', 'layer.trail.flicker'],
    perLevel: 'glitter +0.35; positive levels set flicker to 0.9',
    clamp: 'glitter 0..1',
  },
  'layer.{id}.modifier.amount': {
    key: 'layer.{id}.modifier.amount',
    targets: [
      'layer.modifiers[].amount',
      'layer.modifiers[].count',
      'layer.modifiers[].rate_hz',
      'layer.modifiers[].angular_speed_rad_s',
    ],
    perLevel: 'amount × 1.3; count × 1.25; rate × 1.15',
    clamp: 'schema field limits',
  },
  'layer.{id}.modifier.timing': {
    key: 'layer.{id}.modifier.timing',
    targets: ['layer.modifiers[].at'],
    perLevel: 'at +0.08',
    clamp: 'at 0.05..0.95',
  },
} as const satisfies Record<string, AdjustmentDefinition>;
