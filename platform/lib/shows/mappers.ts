/**
 * Pure mappers from `shows.*` row projections to the domain types in
 * {@link ../show-domain}. No I/O — safe to import from anywhere.
 */
import { parseLaunchPositions } from '@/lib/fireworks/design';
import { compileFireworkDesign } from '@/lib/fireworks/design';
import { safeParseFireworkSpec } from '@/lib/fireworks/spec';
import type {
  FireworkSpecification,
  Show,
  ShowCue,
  ShowGenerationStatus,
  ShowStatus,
} from '@/lib/show-domain';
import type {
  EffectSpecProjection,
  FireworkEffectProjection,
  FireworkVariantProjection,
  ReplayCueRow,
  ShowCueProjection,
  ShowProjection,
} from './types';

/** Map a `shows` row to the domain {@link Show}, defaulting nullable enums. */
export function mapShow(row: ShowProjection): Show {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    song: row.song,
    artist: row.artist,
    status: (row.status as ShowStatus) ?? 'draft',
    durationSeconds: row.duration_seconds,
    budgetCents: row.budget_cents,
    totalCents: row.total_cents,
    effectsCount: row.effects_count,
    syncPercent: row.sync_percent == null ? null : Number(row.sync_percent),
    safetyMeters: row.safety_meters,
    timeOfDay: row.time_of_day,
    location: row.location,
    description: row.description,
    moodTags: row.mood_tags ?? [],
    audioPath: row.audio_path,
    musicAnalysisId: row.music_analysis_id,
    generationStatus: (row.generation_status as ShowGenerationStatus) ?? 'idle',
    generationError: row.generation_error,
    generatedCueCount: row.generated_cue_count,
    generationStartedAt: row.generation_started_at,
    generationCompletedAt: row.generation_completed_at,
    launchPositions: parseLaunchPositions(row.launch_positions_json),
    updatedAt: row.updated_at,
  };
}

/**
 * Map a `show_cues` row to {@link ShowCue}. Clamps `launch_position_index`
 * to the valid 0..2 range so a bad write can't crash the renderer.
 */
export function mapCue(row: ShowCueProjection): ShowCue {
  return {
    id: row.id,
    position: row.position,
    timeSeconds: row.time_seconds == null ? null : Number(row.time_seconds),
    description: row.description,
    productId: row.product_id,
    seedOverride: row.seed_override,
    launchPositionIndex: Math.max(
      0,
      Math.min(2, Math.floor(Number(row.launch_position_index ?? 0))),
    ),
  };
}

/**
 * Map an `effect_specs` row to {@link FireworkSpecification}.
 * `index` becomes the sortOrder; `caliber` and `shotCount` are filled in by
 * the product-aware caller (`listFireworkProducts`).
 */
export function mapEffectSpecification(
  row: EffectSpecProjection,
  index = 0,
  caliber: string | null = null,
): FireworkSpecification {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    sortOrder: index,
    durationSeconds: row.duration_seconds,
    heightMeters: row.height_meters,
    caliber,
    shotCount: null,
    spec: safeParseFireworkSpec(row.spec_json),
    rawSpec: row.spec_json,
    renderDesign: compileFireworkDesign({ legacySpec: row.spec_json }),
    baseEffect: null,
    variant: null,
  };
}

function firstEffect(
  effect: FireworkVariantProjection['firework_effects'],
): FireworkEffectProjection | null {
  if (!effect) return null;
  return Array.isArray(effect) ? (effect[0] ?? null) : effect;
}

export function mapFireworkVariantSpecification(
  row: FireworkVariantProjection,
  index = 0,
  shotCaliber: string | null = null,
  legacySpec: unknown = null,
): FireworkSpecification {
  const effect = firstEffect(row.firework_effects);
  const caliber = shotCaliber ?? row.caliber;
  const renderDesign = compileFireworkDesign({
    baseModel: effect?.model_json,
    variantOverrides: row.render_overrides_json,
    primaryColor: row.primary_color,
    colorPalette: row.color_palette,
    legacySpec,
  });

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    sortOrder: index,
    durationSeconds: row.duration_seconds,
    heightMeters: row.height_meters,
    caliber,
    shotCount: null,
    spec: safeParseFireworkSpec(row.variant_json),
    rawSpec: row.render_overrides_json,
    renderDesign,
    baseEffect: effect
      ? {
          id: effect.id,
          slug: effect.slug,
          name: effect.name,
          patternKey: effect.pattern_key,
        }
      : null,
    variant: {
      id: row.id,
      slug: row.slug,
      primaryColor: row.primary_color,
      secondaryColor: row.secondary_color,
      colorPalette: row.color_palette,
    },
  };
}

/** Same as {@link mapCue} but returns `null` when the row has no scheduled time. */
export function mapReplayCueBase(row: ReplayCueRow): ShowCue | null {
  if (row.time_seconds == null) return null;
  return mapCue(row);
}
