import { parseCover } from '@/lib/cover';
import type { Database, Json } from '@/lib/database.types';
import type { ShowTemplateSummary } from '@/lib/show-template-summary';
import type { ShowTemplate, ShowTemplateCue } from './types';

export type ShowTemplateRow = Database['public']['Tables']['show_presets']['Row'] & {
  show_preset_like_counts?: { like_count: number } | Array<{ like_count: number }> | null;
};

export type ShowTemplateSummaryRow = Omit<
  ShowTemplateRow,
  'composition_signature' | 'preview_cues'
> & {
  composition_signature?: string | null;
  preview_cues?: Json;
};

function isRecord(value: Json | undefined): value is Record<string, Json | undefined> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normaliseCueEmphasis(value: unknown): ShowTemplateCue['emphasis'] {
  return value === 'accent' || value === 'peak' ? value : 'normal';
}

function unresolvedTemplateCue(index: number, description?: unknown): ShowTemplateCue {
  return {
    timeSeconds: 0,
    description:
      typeof description === 'string' && description.trim()
        ? `${description.trim()} (stored cue needs repair)`
        : `Unresolved cue ${index + 1} (stored value needs repair)`,
    catalogueItemId: null,
    catalogueItemSlug: `invalid-cue-${index + 1}`,
    launchPositionIndex: index % 3,
    emphasis: 'normal',
  };
}

/** Parse template cues without hiding malformed stored entries from repair or clone guards. */
export function parseTemplateCues(value: Json): ShowTemplateCue[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    if (!isRecord(item)) return unresolvedTemplateCue(index);
    const timeSeconds = Number(item.timeSeconds);
    const description = item.description;
    const fireworkSlug = typeof item.fireworkSlug === 'string' ? item.fireworkSlug : undefined;
    const catalogueItemId = typeof item.catalogueItemId === 'string' ? item.catalogueItemId : null;
    const catalogueItemSlug =
      typeof item.catalogueItemSlug === 'string' ? item.catalogueItemSlug : null;
    const launchPositionIndex = Number(item.launchPositionIndex ?? index % 3);
    const emphasisIsValid =
      item.emphasis == null ||
      item.emphasis === 'normal' ||
      item.emphasis === 'accent' ||
      item.emphasis === 'peak';
    if (
      !Number.isFinite(timeSeconds) ||
      timeSeconds < 0 ||
      timeSeconds > 60 * 60 ||
      typeof description !== 'string' ||
      !description.trim() ||
      description.trim().length > 180 ||
      !Number.isInteger(launchPositionIndex) ||
      launchPositionIndex < 0 ||
      launchPositionIndex > 2 ||
      !emphasisIsValid ||
      (!fireworkSlug && !catalogueItemId && !catalogueItemSlug)
    ) {
      return unresolvedTemplateCue(index, description);
    }
    return {
      timeSeconds,
      description,
      ...(fireworkSlug ? { fireworkSlug } : {}),
      catalogueItemId,
      catalogueItemSlug,
      launchPositionIndex,
      emphasis: normaliseCueEmphasis(item.emphasis),
    };
  });
}

function showPresetLikeCount(row: ShowTemplateSummaryRow): number {
  const joined = row.show_preset_like_counts;
  const count = Array.isArray(joined) ? joined[0]?.like_count : joined?.like_count;
  return Number.isInteger(count) && Number(count) >= 0 ? Number(count) : 0;
}

function showPresetCompositionSignature(row: ShowTemplateSummaryRow): string {
  const storedSignature = row.composition_signature?.trim();
  if (storedSignature) return storedSignature;

  if (!Array.isArray(row.preview_cues)) return `preset:${row.id}`;
  const cueKeys = new Set<string>();
  for (const cue of row.preview_cues) {
    if (!isRecord(cue)) continue;
    const key = [cue.catalogueItemId, cue.catalogueItemSlug, cue.fireworkSlug].find(
      (value): value is string => typeof value === 'string' && value.length > 0,
    );
    if (key) cueKeys.add(key);
  }
  return cueKeys.size > 0 ? Array.from(cueKeys).sort().join('|') : `preset:${row.id}`;
}

/** Map metadata that is safe to serialise in public Explore list responses. */
export function mapShowTemplateSummary(row: ShowTemplateSummaryRow): ShowTemplateSummary {
  const maybePublished = row as Partial<ShowTemplateSummaryRow>;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    theme: row.theme,
    description: row.description,
    durationSeconds: row.duration_seconds,
    budgetCents: row.budget_cents,
    totalCents: row.total_cents,
    effectsCount: row.effects_count,
    compositionSignature: showPresetCompositionSignature(row),
    timeOfDay: row.time_of_day,
    moodTags: row.mood_tags ?? [],
    coverShader: parseCover(row.cover_shader),
    coverImagePath: row.cover_image_path ?? null,
    isFeatured: row.is_featured,
    isPublished: maybePublished.is_published ?? true,
    publishedAt: maybePublished.published_at ?? row.created_at,
    sortOrder: row.sort_order,
    likeCount: showPresetLikeCount(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Map a cue-bearing row for a scoped preview, detail or admin read. */
export function mapShowTemplate(row: ShowTemplateRow): ShowTemplate {
  return {
    ...mapShowTemplateSummary(row),
    previewCues: parseTemplateCues(row.preview_cues),
  };
}
