/** Show preset editor model: local cue shape, timeline constants and pure helpers. */
import type { ShowTemplateCue } from '@/lib/show-templates/types';
import type { FireworkSpecification, ReplayCue } from '@/lib/show-domain';
import { formatDuration } from '@/lib/show-domain';
import { clamp } from '@/lib/utils';

export const PX_PER_SECOND = 72;

export const MIN_CLIP_PX = 56;

export const TIMELINE_ROW_COUNT = 3;

export const TIMELINE_ROW_HEIGHT_PX = 34;

export const TIMELINE_ROW_GAP_PX = 8;

export const TIMELINE_INSET_PX = 2;

export const MIN_TIMELINE_SECONDS = 10;

export const DEFAULT_CUE_DURATION_SECONDS = 2.4;

export const MAX_TIMELINE_SECONDS = 60 * 60;

export const FIREWORK_SLUG_ALIASES: Record<string, string> = {
  chrysanthemum: 'gold-chrysanthemum',
  comet: 'comet-gold',
  finale_barrage: 'white-strobe',
  peony: 'gold-chrysanthemum',
  willow: 'willow-gold',
};

export type CueEmphasis = 'normal' | 'accent' | 'peak';

export type LocalCue = {
  uid: string;
  catalogueItemId: string;
  catalogueItemSlug: string;
  timeSeconds: number;
  description: string;
  launchPositionIndex: number;
  emphasis: CueEmphasis;
};

export type ProductPickerMode = 'insert' | 'replace';

export type ProductKindFilter = 'all' | 'firework' | 'multishot';

let cueUidCounter = 0;

export function makeCueUid(): string {
  cueUidCounter += 1;
  return `preset-cue-${Date.now().toString(36)}-${cueUidCounter}`;
}

export function normaliseCueTime(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return clamp(Number(value.toFixed(2)), 0, MAX_TIMELINE_SECONDS);
}

export function normaliseLaunchPositionIndex(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return clamp(Math.round(value), 0, TIMELINE_ROW_COUNT - 1);
}

export function cueDurationOf(spec: FireworkSpecification | undefined): number {
  const duration = spec?.occupancyDurationSeconds ?? spec?.durationSeconds;
  return duration && Number.isFinite(duration) && duration > 0
    ? duration
    : DEFAULT_CUE_DURATION_SECONDS;
}

export function cueVisualSeconds(spec: FireworkSpecification | undefined): number {
  return Math.max(cueDurationOf(spec), MIN_CLIP_PX / PX_PER_SECOND);
}

export function paletteOf(spec: FireworkSpecification | undefined): {
  primary: string;
  secondary: string;
} {
  const palette = spec?.variant?.colorPalette.filter(Boolean) ?? [];
  const primary = spec?.variant?.primaryColor ?? palette[0] ?? '#38bdf8';
  const secondary =
    spec?.variant?.secondaryColor ??
    palette.find((color) => color !== primary) ??
    (spec?.shotCount && spec.shotCount > 1 ? '#f97316' : '#a78bfa');
  return { primary, secondary };
}

export function productKindOf(spec: FireworkSpecification): 'multishot' | 'firework' {
  return (spec.shotCount ?? 1) > 1 ? 'multishot' : 'firework';
}

export function buildProductLookup(
  specs: FireworkSpecification[],
): Map<string, FireworkSpecification> {
  const lookup = new Map<string, FireworkSpecification>();
  for (const spec of specs) {
    const keys = [
      spec.id,
      spec.slug,
      spec.variant?.id,
      spec.variant?.slug,
      spec.baseEffect?.id,
      spec.baseEffect?.slug,
    ].filter((key): key is string => Boolean(key));
    for (const key of keys) {
      if (!lookup.has(key)) lookup.set(key, spec);
    }
  }
  return lookup;
}

export function resolveProduct(
  cue: ShowTemplateCue,
  lookup: Map<string, FireworkSpecification>,
): FireworkSpecification | null {
  const alias = cue.fireworkSlug ? FIREWORK_SLUG_ALIASES[cue.fireworkSlug] : undefined;
  const keys = [cue.catalogueItemId, cue.catalogueItemSlug, cue.fireworkSlug, alias].filter(
    (key): key is string => Boolean(key),
  );
  for (const key of keys) {
    const spec = lookup.get(key);
    if (spec) return spec;
  }
  return null;
}

export function toLocalCue(
  cue: ShowTemplateCue,
  index: number,
  lookup: Map<string, FireworkSpecification>,
): LocalCue {
  const product = resolveProduct(cue, lookup);
  const unresolvedKey =
    cue.catalogueItemId ?? cue.catalogueItemSlug ?? cue.fireworkSlug ?? `unresolved-${index + 1}`;
  return {
    uid: makeCueUid(),
    catalogueItemId: product?.id ?? unresolvedKey,
    catalogueItemSlug: product?.slug ?? cue.catalogueItemSlug ?? cue.fireworkSlug ?? unresolvedKey,
    timeSeconds: normaliseCueTime(cue.timeSeconds),
    description: cue.description || product?.name || 'Unresolved catalogue item',
    launchPositionIndex: normaliseLaunchPositionIndex(cue.launchPositionIndex ?? index % 3),
    emphasis: cue.emphasis ?? 'normal',
  };
}

export function serialiseCues(cues: LocalCue[]): string {
  return JSON.stringify(
    [...cues]
      .sort((a, b) => a.timeSeconds - b.timeSeconds)
      .map((cue) => ({
        catalogueItemId: cue.catalogueItemId,
        catalogueItemSlug: cue.catalogueItemSlug,
        timeSeconds: normaliseCueTime(cue.timeSeconds),
        description: cue.description.trim(),
        launchPositionIndex: normaliseLaunchPositionIndex(cue.launchPositionIndex),
        emphasis: cue.emphasis,
      })),
  );
}

export function formatTimelineTimestamp(seconds: number): string {
  const totalTenths = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds * 10)) : 0;
  const minutes = Math.floor(totalTenths / 600);
  const secondsWithinMinute = Math.floor((totalTenths % 600) / 10);
  const tenths = totalTenths % 10;
  return `${minutes}:${secondsWithinMinute.toString().padStart(2, '0')}.${tenths}`;
}

export function detailsSnapshot({
  title,
  slug,
  theme,
  description,
  durationSeconds,
  budgetDollars,
  timeOfDay,
  moodTagText,
  isFeatured,
  sortOrder,
}: {
  title: string;
  slug: string;
  theme: string;
  description: string;
  durationSeconds: string;
  budgetDollars: string;
  timeOfDay: string;
  moodTagText: string;
  isFeatured: boolean;
  sortOrder: string;
}): string {
  return JSON.stringify({
    title: title.trim(),
    slug: slug.trim(),
    theme: theme.trim(),
    description: description.trim(),
    durationSeconds: Number(durationSeconds),
    budgetDollars: budgetDollars.trim(),
    timeOfDay: timeOfDay.trim(),
    moodTagText: moodTagText.trim(),
    isFeatured,
    sortOrder: Number(sortOrder),
  });
}

export function toMoodTags(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export function toReplayCues(
  cues: LocalCue[],
  specsById: Map<string, FireworkSpecification>,
): ReplayCue[] {
  return [...cues]
    .sort((a, b) => a.timeSeconds - b.timeSeconds)
    .flatMap((cue, index) => {
      const firework = specsById.get(cue.catalogueItemId);
      if (!firework) return [];
      return [
        {
          id: cue.uid,
          position: index + 1,
          timeSeconds: cue.timeSeconds,
          description: cue.description,
          productId: cue.catalogueItemId,
          launchPositionIndex: cue.launchPositionIndex,
          emphasis: cue.emphasis,
          firework,
        },
      ];
    });
}

export function buildNewCue(
  product: FireworkSpecification,
  atSeconds: number,
  launchPositionIndex: number,
): LocalCue {
  return {
    uid: makeCueUid(),
    catalogueItemId: product.id,
    catalogueItemSlug: product.slug,
    timeSeconds: normaliseCueTime(atSeconds),
    description: product.name,
    launchPositionIndex: normaliseLaunchPositionIndex(launchPositionIndex),
    emphasis: 'normal',
  };
}

export function productLabel(product: FireworkSpecification): string {
  return productKindOf(product) === 'multishot'
    ? `${product.name} (${product.shotCount ?? 1} shots)`
    : product.name;
}

export function productSummary(product: FireworkSpecification): string {
  const shotCount = product.shotCount ?? 1;
  return `${productKindOf(product)} - ${formatDuration(product.durationSeconds)} - ${shotCount} shot${
    shotCount === 1 ? '' : 's'
  }`;
}
