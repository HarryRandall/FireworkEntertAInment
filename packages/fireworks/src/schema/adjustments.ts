/** Stored quick-adjustment registry and pure design-resolution implementation. */
import type { Design, Layer } from './design.generated';

/** Stored integer strength from maximum reduction (-3) to maximum increase (3). */
export type AdjustmentLevel = -3 | -2 | -1 | 0 | 1 | 2 | 3;

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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const rounded = (value: number, min: number, max: number) => clamp(Math.round(value), min, max);

// This registry is the single mapping from saved Finale-style adjective controls to v1 fields.
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

type AdjustmentKey = keyof typeof ADJUSTMENT_REGISTRY;
const layerKey = /^layer\.([A-Za-z0-9][A-Za-z0-9_-]*)\.(.+)$/;

/** Looks up the documented definition for a stored adjustment key. */
export function adjustmentDefinition(
  key: string,
): (typeof ADJUSTMENT_REGISTRY)[AdjustmentKey] | undefined {
  if (key in ADJUSTMENT_REGISTRY) return ADJUSTMENT_REGISTRY[key as AdjustmentKey];
  const match = key.match(layerKey);
  if (!match) return undefined;
  const template = `layer.{id}.${match[2]}` as AdjustmentKey;
  return ADJUSTMENT_REGISTRY[template];
}

function adjustLayer(layer: Layer, field: string, level: number): void {
  if (field === 'size') layer.radius_m = clamp(layer.radius_m * 1.15 ** level, 0, 500);
  else if (field === 'stars') layer.count = rounded(layer.count * 1.3 ** level, 3, 10000);
  else if (field === 'brightness')
    layer.brightness = layer.brightness.map(([at, value]) => [
      at,
      clamp(value * 1.2 ** level, 0, 10),
    ]);
  else if (field === 'burn') layer.life_s = clamp(layer.life_s * 1.25 ** level, 0.001, 120);
  else if (field === 'droop')
    layer.gravity_m_s2 = clamp(layer.gravity_m_s2 * 1.35 ** level, -40, 100);
  else if (field === 'spread') layer.speed_var = clamp(layer.speed_var + 0.12 * level, 0, 0.9);
  else if (field === 'star_size') layer.head.size = clamp(layer.head.size * 1.2 ** level, 0, 10);
  else if (field === 'trail.length')
    layer.trail.length_s = clamp(layer.trail.length_s * 1.3 ** level, 0.001, 20);
  else if (field === 'trail.density')
    layer.trail.sparks = rounded(Math.max(layer.trail.sparks, 2) * 1.35 ** level, 0, 10000);
  else if (field === 'trail.spray')
    layer.trail.spread_m_s = clamp(layer.trail.spread_m_s * 1.3 ** level, 0, 200);
  else if (field === 'trail.glitter') {
    layer.trail.glitter = clamp(layer.trail.glitter + 0.35 * level, 0, 1);
    if (level > 0) layer.trail.flicker = 0.9;
  } else if (field === 'modifier.amount')
    for (const modifier of layer.modifiers) {
      modifier.amount = clamp(modifier.amount * 1.3 ** level, -20, 20);
      modifier.count = rounded(modifier.count * 1.25 ** level, 1, 400);
      modifier.rate_hz = clamp(modifier.rate_hz * 1.15 ** level, 0.001, 500);
      modifier.angular_speed_rad_s = clamp(modifier.angular_speed_rad_s * 1.3 ** level, -500, 500);
    }
  else if (field === 'modifier.timing')
    for (const modifier of layer.modifiers)
      modifier.at = clamp(modifier.at + 0.08 * level, 0.05, 0.95);
}

/** Applies stored levels to a cloned design and returns resolved renderer inputs. */
export function resolveDesign(design: Design): Design {
  const resolved = JSON.parse(JSON.stringify(design)) as Design;
  const adjustments = resolved.adjustments as Record<string, AdjustmentLevel> | undefined;
  if (!adjustments || Object.keys(adjustments).length === 0) return resolved;
  for (const [key, level] of Object.entries(adjustments ?? {})) {
    if (!adjustmentDefinition(key)) throw new RangeError(`Unknown adjustment key: ${key}`);
    if (level === 0) continue;
    const layer = key.match(layerKey);
    if (layer) {
      const layerId = layer[1];
      const field = layer[2];
      if (!layerId || !field) throw new RangeError(`Unknown adjustment key: ${key}`);
      let found = false;
      for (const break_ of resolved.breaks)
        for (const candidate of break_.layers)
          if (candidate.id === layerId) {
            adjustLayer(candidate, field, level);
            found = true;
          }
      if (!found) throw new RangeError(`Adjustment layer does not exist: ${layerId}`);
      continue;
    }
    if (resolved.launch) {
      if (key === 'launch.height') {
        const factor = 1.12 ** level;
        resolved.launch.height_m = clamp(resolved.launch.height_m * factor, 0, 1000);
        resolved.launch.time_s = clamp(resolved.launch.time_s * Math.sqrt(factor), 0.001, 120);
      }
      if (key === 'launch.tail') {
        resolved.launch.sparks = rounded(resolved.launch.sparks * 1.35 ** level, 0, 10000);
        resolved.launch.spread = clamp(resolved.launch.spread * 1.15 ** level, 0, 20);
      }
      if (key === 'launch.climb')
        resolved.launch.time_s = clamp(resolved.launch.time_s * 0.85 ** level, 0.001, 120);
    }
    if (key === 'break.flash')
      for (const break_ of resolved.breaks)
        break_.core.flash = clamp(break_.core.flash * 1.3 ** level, 0, 10);
    if (key === 'break.core_ring')
      for (const break_ of resolved.breaks)
        break_.core.radius = clamp(break_.core.radius * 1.15 ** level, 0, 4);
    if (resolved.kind === 'comet' || resolved.kind === 'candle') {
      const comets = resolved.ground.comets;
      if (key === 'ground.height') {
        const factor = 1.12 ** level;
        comets.height_m = clamp(comets.height_m * factor, 0.001, 1000);
        comets.time_s = clamp(comets.time_s * Math.sqrt(factor), 0.001, 120);
      }
      if (key === 'ground.count')
        comets.count = rounded(comets.count + level * (comets.count > 3 ? 2 : 1), 1, 500);
      if (key === 'ground.fan') {
        const spread = comets.spread_deg || (level > 0 ? 12 : 0);
        comets.spread_deg = clamp(spread * 1.25 ** level, 0, 120);
      }
      if (key === 'ground.climb') comets.time_s = clamp(comets.time_s * 0.85 ** level, 0.001, 120);
      if (key === 'ground.star_size') comets.size = clamp(comets.size * 1.15 ** level, 0, 10);
      if (key === 'ground.spin') comets.spin_rad_s = clamp(comets.spin_rad_s + level * 4, 0, 500);
    }
    if (resolved.kind === 'tourbillon') {
      const t = resolved.ground.tourbillon;
      if (key === 'ground.height') {
        const factor = 1.12 ** level;
        t.height_m = clamp(t.height_m * factor, 0.001, 1000);
        t.time_s = clamp(t.time_s * Math.sqrt(factor), 0.001, 120);
      }
      if (key === 'ground.count') t.count = rounded(t.count + level, 1, 500);
      if (key === 'ground.climb') t.time_s = clamp(t.time_s * 0.85 ** level, 0.001, 120);
      if (key === 'ground.spin') t.spin_rad_s = clamp(t.spin_rad_s * 1.25 ** level, 0, 500);
    }
    if (resolved.kind === 'fountain') {
      const f = resolved.ground.fountain;
      if (key === 'ground.height') f.speed_m_s = clamp(f.speed_m_s * 1.1 ** level, 0, 200);
      if (key === 'ground.duration') f.duration_s = clamp(f.duration_s * 1.2 ** level, 0.001, 120);
      if (key === 'ground.density') f.rate_per_s = clamp(f.rate_per_s * 1.25 ** level, 0, 20000);
      if (key === 'ground.spray') f.cone = clamp(f.cone * 1.25 ** level, 0, 4);
    }
  }
  delete resolved.adjustments;
  return resolved;
}
