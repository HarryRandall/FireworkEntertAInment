/**
 * Pure mappers from `shows.*` row projections to the domain types in
 * {@link ../show-domain}. No I/O — safe to import from anywhere.
 */
import { parseLaunchPositions } from '@/lib/fireworks/design';
import { compileFireworkDesign } from '@/lib/fireworks/design';
import { parseCover } from '@/lib/cover';
import {
  FIREWORK_STYLE_DEFAULT_KINDS,
  isFireworkStyleDefaultKind,
} from '@/lib/fireworks/style-defaults';
import { safeParseFireworkSpec } from '@/lib/fireworks/spec';
import type {
  FireworkSpecification,
  Show,
  ShowCue,
  ShowGenerationStatus,
  ShowStatus,
} from '@/lib/show-domain';
import type {
  CatalogueFireworkCardProjection,
  FireworkEffectProjection,
  FireworkStyleDefaultLinkProjection,
  FireworkStyleDefaultProjection,
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
    coverShader: parseCover(row.cover_shader),
    coverImagePath: row.cover_image_path ?? null,
    updatedAt: row.updated_at,
  };
}

/** Coerce a stored emphasis value to the validated union, defaulting to 'normal'. */
function normaliseEmphasis(value: string | null | undefined): 'normal' | 'accent' | 'peak' {
  return value === 'accent' || value === 'peak' ? value : 'normal';
}

/**
 * Map a `show_timeline_items` row to {@link ShowCue}. Clamps `launch_position_index`
 * to the valid 0..2 range so a bad write can't crash the renderer.
 */
export function mapCue(row: ShowCueProjection): ShowCue {
  return {
    id: row.id,
    position: row.position,
    timeSeconds: row.time_seconds == null ? null : Number(row.time_seconds),
    description: row.description,
    productId: row.catalogue_item_id,
    seedOverride: row.seed_override,
    launchPositionIndex: Math.max(
      0,
      Math.min(2, Math.floor(Number(row.launch_position_index ?? 0))),
    ),
    emphasis: normaliseEmphasis(row.emphasis),
  };
}

function firstEffect(
  effect: FireworkVariantProjection['firework_effects'],
): FireworkEffectProjection | null {
  if (!effect) return null;
  return Array.isArray(effect) ? (effect[0] ?? null) : effect;
}

function firstStyleDefault(
  styleDefault:
    | FireworkStyleDefaultProjection
    | FireworkStyleDefaultProjection[]
    | null
    | undefined,
): FireworkStyleDefaultProjection | null {
  if (!styleDefault) return null;
  return Array.isArray(styleDefault) ? (styleDefault[0] ?? null) : styleDefault;
}

function styleDefaultArrayFromLinks(
  links: FireworkStyleDefaultLinkProjection[] | null | undefined,
  legacy: {
    star?: FireworkStyleDefaultProjection | null;
    trail?: FireworkStyleDefaultProjection | null;
  },
): Array<unknown> {
  const byKind = new Map<string, FireworkStyleDefaultProjection>();
  if (legacy.star) byKind.set('star', legacy.star);
  if (legacy.trail) byKind.set('trail', legacy.trail);

  for (const link of links ?? []) {
    if (!isFireworkStyleDefaultKind(link.kind)) continue;
    const styleDefault = firstStyleDefault(link.style_default);
    if (styleDefault) byKind.set(link.kind, styleDefault);
  }

  return FIREWORK_STYLE_DEFAULT_KINDS.map((kind) => byKind.get(kind)?.defaults_json);
}

function firstCatalogueEffect(
  effect: CatalogueFireworkCardProjection['firework_effects'],
): Pick<FireworkEffectProjection, 'id' | 'slug' | 'name' | 'pattern_key'> | null {
  if (!effect) return null;
  return Array.isArray(effect) ? (effect[0] ?? null) : effect;
}

/** Browse-only mapper for catalogue cards that do not need render design data. */
export function mapCatalogueFireworkCard(
  row: CatalogueFireworkCardProjection,
  index = 0,
  shotCaliber: string | null = null,
): FireworkSpecification {
  const effect = firstCatalogueEffect(row.firework_effects);
  const caliber = shotCaliber ?? row.caliber;

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
    spec: safeParseFireworkSpec(null),
    rawSpec: null,
    renderDesign: null,
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

export function mapFireworkVariantSpecification(
  row: FireworkVariantProjection,
  index = 0,
  shotCaliber: string | null = null,
  legacySpec: unknown = null,
): FireworkSpecification {
  const effect = firstEffect(row.firework_effects);
  const caliber = shotCaliber ?? row.caliber;
  const effectStarStyleDefault = firstStyleDefault(effect?.star_style_default);
  const effectTrailStyleDefault = firstStyleDefault(effect?.trail_style_default);
  const fireworkStarStyleDefault = firstStyleDefault(row.star_style_default);
  const fireworkTrailStyleDefault = firstStyleDefault(row.trail_style_default);
  const effectStyleDefaults = styleDefaultArrayFromLinks(effect?.style_default_links, {
    star: effectStarStyleDefault,
    trail: effectTrailStyleDefault,
  });
  const fireworkStyleDefaults = styleDefaultArrayFromLinks(row.style_default_links, {
    star: fireworkStarStyleDefault,
    trail: fireworkTrailStyleDefault,
  });
  const renderDesign = compileFireworkDesign({
    baseModel: effect?.model_json,
    effectStyleDefaults,
    fireworkStyleDefaults,
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
