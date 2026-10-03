/** Small bounded numeric search spaces, expressed in canonical design units. */
import type { Design } from '@showcrafter/fireworks';
import designSchema from '@showcrafter/fireworks/schema/design.v1.json' with { type: 'json' };

/** Numeric design path and its search limits in the field's metres, seconds or dimensionless units. */
export interface Parameter {
  path: string;
  minimum: number;
  maximum: number;
  integer?: boolean;
}

// Search bounds are visual fitting judgements within the canonical schema, not calibrated physics.
const MIN_HEIGHT_M = 10;
const MAX_HEIGHT_M = 100;
const MIN_LAUNCH_S = 0.5;
const MAX_LAUNCH_S = 3;
const MIN_RADIUS_M = 5;
const MAX_RADIUS_M = 60;
const MIN_DRAG_PER_S = 0.2;
const MAX_DRAG_PER_S = 5;
const MIN_LIFE_S = 0.5;
const MAX_LIFE_S = 5;
// Canonical trail schema minimum, in seconds; zero-length trails are not valid documents.
const MIN_TRAIL_S = 0.001;
// One-second upper trail envelope, a visual fitting judgement rather than a physical limit.
const MAX_TRAIL_S = 1;
const SHELL_PARAMETERS: readonly Parameter[] = [
  { path: 'launch.height_m', minimum: MIN_HEIGHT_M, maximum: MAX_HEIGHT_M },
  { path: 'launch.time_s', minimum: MIN_LAUNCH_S, maximum: MAX_LAUNCH_S },
  { path: 'breaks.0.layers.0.radius_m', minimum: MIN_RADIUS_M, maximum: MAX_RADIUS_M },
  { path: 'breaks.0.layers.0.drag_per_s', minimum: MIN_DRAG_PER_S, maximum: MAX_DRAG_PER_S },
  { path: 'breaks.0.layers.0.life_s', minimum: MIN_LIFE_S, maximum: MAX_LIFE_S },
  { path: 'breaks.0.layers.0.trail.length_s', minimum: MIN_TRAIL_S, maximum: MAX_TRAIL_S },
];
// Ground searches use four continuous fields present in each canonical ground subtype.
const GROUND_FIELDS: Record<string, readonly string[]> = {
  fountain: ['duration_s', 'speed_m_s', 'cone', 'life_s'],
  wheel: ['duration_s', 'radius_m', 'spin_hz', 'height_m'],
  spinner: ['duration_s', 'spin_rad_s', 'wander_m', 'sparks'],
  tourbillon: ['time_s', 'height_m', 'radius_m', 'spin_rad_s'],
  comets: ['height_m', 'time_s', 'tail_life_s', 'size'],
};
// Relative interval around a template: positive fields remain within half to twice their initial value.
const LOWER_FACTOR = 0.5;
const UPPER_FACTOR = 2;

/** Read a dot-separated numeric path, rejecting absent, non-numeric or non-finite values. */
export function parameterValue(design: Design, path: string): number {
  let value: unknown = design;
  for (const key of path.split('.')) {
    if (value === null || typeof value !== 'object' || !(key in value)) {
      throw new Error('Missing parameter');
    }
    value = (value as Record<string, unknown>)[key];
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Numeric parameter required');
  }
  return value;
}

/** Choose six shell or four ground fields; reject subtypes without a supported numeric search space. */
export function parametersFor(design: Design): readonly Parameter[] {
  if (design.launch) {
    return SHELL_PARAMETERS;
  }
  const ground = design.ground;
  const subtype = Object.keys(ground).find((key) => key !== 'kind');
  const fields = subtype !== undefined ? GROUND_FIELDS[subtype] : undefined;
  if (subtype === undefined || !fields) {
    throw new Error('Unsupported ground search space');
  }
  return fields.map((field) => {
    const path = `ground.${subtype}.${field}`;
    const value = parameterValue(design, path);
    const definitions = designSchema.definitions as unknown as Record<
      string,
      { properties: Record<string, { type: string; minimum: number; maximum: number }> }
    >;
    const constraints = definitions[subtype]?.properties[field];
    if (!constraints) {
      throw new Error('Canonical parameter bounds required');
    }
    const endpoints = [value * LOWER_FACTOR, value * UPPER_FACTOR];
    return {
      path,
      minimum: Math.max(constraints.minimum, Math.min(...endpoints)),
      maximum: Math.min(constraints.maximum, Math.max(1, ...endpoints)),
      integer: constraints.type === 'integer',
    };
  });
}

/** Copy a design and set a bounded vector in normalised [0,1] coordinates; never mutate the input. */
export function applyParameters(design: Design, vector: readonly number[]): Design {
  const parameters = parametersFor(design);
  if (parameters.length !== vector.length) {
    throw new Error('Parameter dimension mismatch');
  }
  const result = structuredClone(design);
  parameters.forEach((parameter, index) => {
    const fraction = vector[index];
    if (fraction === undefined || !Number.isFinite(fraction) || fraction < 0 || fraction > 1) {
      throw new Error('Bounded parameter vector required');
    }
    const keys = parameter.path.split('.');
    const leaf = keys.pop();
    let target: unknown = result;
    for (const key of keys) {
      target = (target as Record<string, unknown>)[key];
    }
    if (leaf === undefined) {
      throw new Error('Parameter path required');
    }
    const value = parameter.minimum + fraction * (parameter.maximum - parameter.minimum);
    (target as Record<string, unknown>)[leaf] =
      parameter.integer === true ? Math.round(value) : value;
  });
  return result;
}
