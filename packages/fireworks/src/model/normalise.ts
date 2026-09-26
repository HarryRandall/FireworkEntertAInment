import { RendererValidationError } from './diagnostics.ts';
import type { RecordLike } from './records.ts';
import { deepMergeDesign, isRecord } from './records.ts';
import type { FireworkDesign, FireworkStarLayer } from './schema.ts';
import { FireworkDesignSchema, MAX_STAR_COUNT } from './schema.ts';
import type { BurstTrail } from './trail-presets.ts';
import {
  isBurstTrailPreset,
  makeBurstTrailPreset,
  normaliseBurstTrailStops,
} from './trail-presets.ts';

export function normaliseBurstTrail(trail: BurstTrail): BurstTrail {
  const presetDefaults = makeBurstTrailPreset(trail.preset);
  const merged = deepMergeDesign(presetDefaults, trail) as BurstTrail;
  return {
    ...merged,

    stops: normaliseBurstTrailStops(merged.stops.length > 0 ? merged.stops : presetDefaults.stops),
  };
}

export function hydrateBurstTrailFragment(fragment: RecordLike): BurstTrail {
  const preset = isBurstTrailPreset(fragment.preset) ? fragment.preset : 'custom';
  return normaliseBurstTrail(deepMergeDesign(makeBurstTrailPreset(preset), fragment) as BurstTrail);
}

export function hydrateBurstTrailDefaults(source: unknown): unknown {
  if (!isRecord(source)) return source;

  let hydrated: RecordLike | null = null;
  const write = (key: string, value: unknown) => {
    hydrated ??= { ...source };
    hydrated[key] = value;
  };

  if (isRecord(source.burstTrail)) {
    write('burstTrail', hydrateBurstTrailFragment(source.burstTrail));
  }

  const stars = isRecord(source.stars) ? source.stars : null;
  if (stars) {
    let hydratedStars: RecordLike | null = null;
    for (const layerKey of ['outer', 'core'] as const) {
      const layer = isRecord(stars[layerKey]) ? stars[layerKey] : null;
      if (!layer || !isRecord(layer.burstTrail)) continue;
      hydratedStars ??= { ...stars };
      hydratedStars[layerKey] = {
        ...layer,
        burstTrail: hydrateBurstTrailFragment(layer.burstTrail),
      };
    }
    if (hydratedStars) write('stars', hydratedStars);
  }

  return hydrated ?? source;
}

export function normaliseStarLayer(layer: FireworkStarLayer): FireworkStarLayer {
  return {
    ...layer,
    count: Math.min(MAX_STAR_COUNT, Math.max(1, Math.round(layer.count))),
    burstTrail: normaliseBurstTrail(layer.burstTrail),
  };
}

export function normaliseFireworkDesign(design: FireworkDesign): FireworkDesign {
  const outer = normaliseStarLayer(design.stars.outer);
  return {
    ...design,
    size: outer.count,
    burst: outer.burst,
    burstTrail: outer.burstTrail,
    stars: { outer, core: normaliseStarLayer(design.stars.core) },
  };
}

export const DEFAULT_DESIGN: FireworkDesign = normaliseFireworkDesign(
  FireworkDesignSchema.parse({}),
);

export function safeParseFireworkDesign(input: unknown): FireworkDesign {
  const parsed = FireworkDesignSchema.safeParse(input);
  if (!parsed.success)
    throw new RendererValidationError(
      parsed.error.issues.map((issue) => ({
        path: issue.path.map(String),
        message: issue.message,
      })),
    );
  return normaliseFireworkDesign(parsed.data);
}

/**
 * Validate a partial editor/default fragment against a complete design without
 * silently replacing an invalid model with {@link DEFAULT_DESIGN}.
 */
export function fireworkDesignFragmentError(input: unknown): string | null {
  if (!isRecord(input)) return 'Renderer settings must be a JSON object.';
  const merged = deepMergeDesign(DEFAULT_DESIGN, hydrateBurstTrailDefaults(input));
  const parsed = FireworkDesignSchema.safeParse(merged);
  if (parsed.success) return null;

  return parsed.error.issues
    .slice(0, 4)
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'renderer settings';
      return `${path}: ${issue.message}`;
    })
    .join('; ');
}
